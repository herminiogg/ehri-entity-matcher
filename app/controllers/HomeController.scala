package controllers

import akka.{NotUsed, japi}
import akka.stream.Materializer
import akka.stream.scaladsl.{Flow, Framing, Sink, Source}
import akka.util.ByteString
import com.fasterxml.jackson.dataformat.csv.{CsvMapper, CsvSchema}
import com.herminiogarcia.label2thesaurus.reconciliation.Reconciler
import models.Match
import play.api.Configuration
import play.api.libs.json.{JsValue, Json}
import play.api.libs.streams.Accumulator
import play.api.libs.ws.WSClient
import play.api.mvc.WebSocket.MessageFlowTransformer
import play.api.mvc._

import java.net.URL
import java.util.Locale
import javax.inject._
import scala.concurrent.{ExecutionContext, Future}

@Singleton
class HomeController @Inject()(
  cc: ControllerComponents,
  ws: WSClient,
  config: Configuration
)(implicit ec: ExecutionContext, mat: Materializer) extends AbstractController(cc) {

  private val logger = play.api.Logger(classOf[HomeController])

  implicit val messageFlowTransformer: MessageFlowTransformer[String, JsValue] =
    MessageFlowTransformer.jsonMessageFlowTransformer[String, JsValue]

  private def country(code: String): String = {
    new Locale("", code).getDisplayCountry(Locale.ENGLISH)
  }

  private def configSettings(path: String): Seq[(String, String)] = {
    config.getOptional[Configuration](path).map { conf =>
      conf.keys.map(k => k -> conf.getOptional[String](k)).collect {
        case (k, Some(s)) => k -> s
      }.toSeq
    }.getOrElse(Seq.empty)
  }

  private def solrSettings: Seq[(String, String)] = configSettings("solr.global")

  private def solrUrl: String = {
    val host = config.get[String]("solr.host")
    val port = config.get[String]("solr.port")
    val core = config.get[String]("solr.core")
    s"http://$host:$port/solr/$core/select"
  }

  private def typeSettings(kind: Option[String]): Seq[(String, String)] =
    kind.map(s => configSettings(s"solr.$s")).getOrElse(Seq.empty[(String, String)])

  def query(text: String, vocabularies: String, algorithm: String, threshold: Double): Future[Seq[Match]] = {
    val listVocabs = vocabularies.split("/n").map(v => new URL(v.trim)).toList
    Future {
      new Reconciler(threshold, false, Option(algorithm), false).reconcile(
        List(text),
        listVocabs,
        scala.Option.empty
      ).map(r => {
        new Match(r.label, r.termLabel, r.lang, r.term, r.confidence)
      })
    }
  }

  def index(): Action[AnyContent] = Action { implicit request: Request[AnyContent] =>
    Ok(views.html.index())
  }

  def find(text: String, vocabularies: String, algorithm: String, threshold: Double): Action[AnyContent] = Action.async { implicit request =>
    query(text, vocabularies, algorithm, threshold).map { docs =>
      Ok(Json.toJson(docs))
    }
  }

  private def transformFlow(vocabularies: String, algorithm: String, threshold: Double): Flow[String, (String, Seq[Match]), NotUsed] = Flow[String]
    .filter(_.trim.nonEmpty)
    .mapAsync(1)(s => query(s, vocabularies, algorithm, threshold).map(results => s -> results))

  private val schema = CsvSchema.emptySchema()
  private val mapper = new CsvMapper().writer(schema)

  private def bodyParser(vocabularies: String, algorithm: String, threshold: Double): BodyParser[Source[ByteString, _]] = BodyParser { _ =>
    // Chunk incoming bytes by newlines, truncating them if the lines
    // are longer than 1000 bytes...
    val f = Flow[ByteString]
      .via(Framing.delimiter(ByteString("\n"), 1000, allowTruncation = true))
      .map(bs => bs.utf8String)
      .via(transformFlow(vocabularies, algorithm, threshold))
      .flatMapConcat { case (s, results) => Source(results.map(r => s -> r).toList) }
      .map { case (s, r) =>
        mapper.writeValueAsBytes((s +: r.toCsv).toArray)
      }
      .map(s => ByteString(s))

    Accumulator.source[ByteString]
    .map(_.via(f))
    .map(Right.apply)
  }

  def findPost(vocabularies: String, algorithm: String, threshold: Double): Action[Source[ByteString, _]] =
    Action(bodyParser(vocabularies, algorithm, threshold)) { implicit request =>
      Ok.chunked(request.body).as("text/csv")
    }

  def findWS(vocabularies: String, algorithm: String, threshold: Double): WebSocket = WebSocket.accept[String, String] { request =>
    Flow[String].flatMapConcat(s => Source(s.split("\n").toList))
      .via(transformFlow(vocabularies, algorithm, threshold))
      .map { case (s, m) =>
        Json.stringify(Json.toJson(s -> m))
      }.concat(Source.maybe)
  }

  case class JsonBody(text: String)
  object JsonBody {
    implicit val format = Json.format[JsonBody]
  }

  def findJson(vocabularies: String, algorithm: String, threshold: Double): Action[JsonBody] = Action(parse.json[JsonBody]).async { implicit request =>
    val out: Future[Seq[(String, Seq[Match])]] = Source(request.body.text.split("\n").toList)
      .via(transformFlow(vocabularies, algorithm, threshold))
      .runWith(Sink.seq)
    out.map { data =>
      Ok(Json.toJson(data))
    }
  }
}

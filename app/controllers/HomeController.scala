package controllers

import java.util.Locale

import akka.NotUsed
import akka.stream.Materializer
import akka.stream.scaladsl.{Flow, Framing, Sink, Source}
import akka.util.ByteString
import com.fasterxml.jackson.dataformat.csv.{CsvMapper, CsvSchema}
import javax.inject._
import models.Match
import play.api.Configuration
import play.api.libs.json.{JsObject, JsValue, Json}
import play.api.libs.streams.Accumulator
import play.api.libs.ws.WSClient
import play.api.mvc.WebSocket.MessageFlowTransformer
import play.api.mvc._

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

  private def typeSettings(kind: Option[String]): Seq[(String, String)] =
    kind.map(s => configSettings(s"solr.$s")).getOrElse(Seq.empty[(String, String)])

  def query(text: String, kind: Option[String], phone: Boolean, pop: Boolean): Future[Seq[Match]] = {
    val popBoost: Seq[(String, String)] = if(pop) Seq("bf" -> "population") else Seq.empty[(String,String)]
    val params: Seq[(String,String)] = Seq(
      "qf" -> ("name_exact^5.0 name^1.0 alternateNames" + (if(phone) " name_phone^0.5" else "")),
      "pf" -> "name^50 alternateNames^20",
      "defType" -> "edismax",
      "q" -> text
    ) ++ kind.map(k => "fq" -> s"type:$k").toSeq ++ typeSettings(kind) ++ solrSettings ++ popBoost

    logger.debug(s"Solr params: $params")

    ws.url(config.get[String]("solr.url"))
      .withQueryStringParameters(params: _*)
      .get().map { r =>
      (r.json \ "response" \ "docs").as[Seq[Match]]
        .map(m => m.copy(country = m.countryCode.map(country)))
    }
  }

  def index(): Action[AnyContent] = Action { implicit request: Request[AnyContent] =>
    Ok(views.html.index())
  }

  def find(text: String, kind: Option[String], phone: Boolean, pop: Boolean): Action[AnyContent] = Action.async { implicit request =>
    query(text, kind, phone, pop).map { docs =>
      Ok(Json.toJson(docs))
    }
  }

  private def transformFlow(kind: Option[String], phone: Boolean, pop: Boolean): Flow[String, (String, Seq[Match]), NotUsed] = Flow[String]
    .filter(_.trim.nonEmpty)
    .mapAsync(1)(s => query(s, kind, phone, pop).map(results => s -> results))

  private val schema = CsvSchema.emptySchema()
  private val mapper = new CsvMapper().writer(schema)

  private def bodyParser(kind: Option[String], phone: Boolean, pop: Boolean): BodyParser[Source[ByteString, _]] = BodyParser { _ =>
    // Chunk incoming bytes by newlines, truncating them if the lines
    // are longer than 1000 bytes...
    val f = Flow[ByteString]
      .via(Framing.delimiter(ByteString("\n"), 1000, allowTruncation = true))
      .map(bs => bs.utf8String)
      .via(transformFlow(kind, phone, pop))
      .flatMapConcat { case (s, results) => Source(results.map(r => s -> r).toList) }
      .map { case (s, r) =>
        mapper.writeValueAsBytes((s +: r.toCsv).toArray)
      }
      .map(s => ByteString(s))

    Accumulator.source[ByteString]
    .map(_.via(f))
    .map(Right.apply)
  }

  def findPost(kind: Option[String], phone: Boolean, pop: Boolean): Action[Source[ByteString, _]] =
    Action(bodyParser(kind, phone, pop)) { implicit request =>
      Ok.chunked(request.body).as("text/csv")
    }

  def findWS(kind: Option[String], phone: Boolean, pop: Boolean): WebSocket = WebSocket.accept[String, String] { request =>
    Flow[String].flatMapConcat(s => Source(s.split("\n").toList))
      .via(transformFlow(kind, phone, pop))
      .map { case (s, m) =>
        Json.stringify(Json.toJson(s -> m))
      }.concat(Source.maybe)
  }

  case class JsonBody(text: String)
  object JsonBody {
    implicit val format = Json.format[JsonBody]
  }

  def findJson(kind: Option[String], phone: Boolean, pop: Boolean): Action[JsonBody] = Action(parse.json[JsonBody]).async { implicit request =>
    val out: Future[Seq[(String, Seq[Match])]] = Source(request.body.text.split("\n").toList)
      .via(transformFlow(kind, phone, pop))
      .runWith(Sink.seq)
    out.map { data =>
      Ok(Json.toJson(data))
    }
  }
}

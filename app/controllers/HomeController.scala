package controllers

import java.util.Locale

import akka.NotUsed
import akka.stream.Materializer
import akka.stream.scaladsl.{Flow, Framing, Sink, Source}
import akka.util.ByteString
import com.typesafe.config.Config
import javax.inject._
import models.Match
import play.api.Configuration
import play.api.libs.json.{JsNull, JsString, JsValue, Json}
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

  def query(text: String, kind: Option[String]): Future[Seq[Match]] = {
    val params = Seq(
      "qf" -> "name_exact^5.0 name^1.0 name_phone^0.5 alternateNames",
      "pf" -> "name^50 alternateNames^20",
      "defType" -> "edismax",
      "q" -> text
    ) ++ kind.map(k => "fq" -> s"type:$k").toSeq ++ typeSettings(kind) ++ solrSettings

    logger.debug(s"Solr params: $params")

    ws.url(config.get[String]("solr.url"))
      .withQueryStringParameters(params: _*)
      .get().map { r =>
      (r.json \ "response" \ "docs").as[Seq[Match]]
        .map(m => m.copy(country = m.countryCode.map(country)))
    }
  }

  def index() = Action { implicit request: Request[AnyContent] =>
    Ok(views.html.index())
  }

  def find(text: String, kind: Option[String]): Action[AnyContent] = Action.async { implicit request =>
    query(text, kind).map { docs =>
      Ok(Json.toJson(docs))
    }
  }

  private def transformFlow(kind: Option[String]): Flow[String, (String, Seq[Match]), NotUsed] = Flow[String]
    .filter(_.trim.nonEmpty)
    .mapAsync(1)(s => query(s, kind).map(results => s -> results))


  def bodyParser(kind: Option[String]): BodyParser[Source[ByteString, _]] = BodyParser { _ =>
    // Chunk incoming bytes by newlines, truncating them if the lines
    // are longer than 1000 bytes...
    val f = Flow[ByteString]
      .via(Framing.delimiter(ByteString("\n"), 1000, allowTruncation = true))
      .map(bs => bs.utf8String)
      .via(transformFlow(kind))
      .flatMapConcat { case (s, results) => Source(results.map(r => s -> r).toList) }
      .map { case (s, r) =>
        s"$s,${r.id},${r.name},${r.country},${r.lat},${r.lng},${r.fcl}\n"
      }
      .map(s => ByteString(s))

    Accumulator.source[ByteString]
    .map(_.via(f))
    .map(Right.apply)
  }

  def findPost(kind: Option[String]): Action[Source[ByteString, _]] = Action(bodyParser(kind)) { implicit request =>
    Ok.chunked(request.body).as("text/csv")
  }

  def findWS(kind: Option[String]): WebSocket = WebSocket.accept[String, String] { request =>
    Flow[String].flatMapConcat(s => Source(s.split("\n").toList))
      .via(transformFlow(kind))
      .map { case (s, m) =>
        Json.stringify(Json.toJson(s -> m))
      }.concat(Source.maybe)
  }

  case class JsonBody(text: String)
  object JsonBody {
    implicit val format = Json.format[JsonBody]
  }

  def findJson(kind: Option[String]): Action[JsonBody] = Action(parse.json[JsonBody]).async { implicit request =>
    val out: Future[Seq[(String, Seq[Match])]] = Source(request.body.text.split("\n").toList)
      .via(transformFlow(kind))
      .runWith(Sink.seq)
    out.map { data =>
      Ok(Json.toJson(data))
    }
  }
}

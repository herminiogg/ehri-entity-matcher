package controllers

import akka.NotUsed
import akka.stream.scaladsl.{Flow, Framing, Source}
import akka.util.ByteString
import javax.inject._
import models.Match
import play.api.libs.json.{JsNull, JsValue, Json}
import play.api.libs.streams.Accumulator
import play.api.libs.ws.WSClient
import play.api.mvc.WebSocket.MessageFlowTransformer
import play.api.mvc._

import scala.concurrent.{ExecutionContext, Future}

@Singleton
class HomeController @Inject()(
  cc: ControllerComponents,
  ws: WSClient
)(implicit ec: ExecutionContext) extends AbstractController(cc) {

  implicit val messageFlowTransformer: MessageFlowTransformer[String, JsValue] =
    MessageFlowTransformer.jsonMessageFlowTransformer[String, JsValue]

  def query(text: String): Future[Seq[Match]] = {

    val params = Seq(
      //"fq" -> "ancestors:1.E.EU",
      //"fq" -> "fcl:P",
      "qf" -> "name_exact^5.0 name^1.0 alternateNames",
      "pf" -> "name^50 alternateNames^20",
      "defType" -> "dismax",
      "mm" -> "2",
      "q" -> text,
      "wt" -> "json",
      "indent" -> "on",
      "debugQuery" -> "true"
    )

    ws.url("http://localhost:8983/solr/geonames/select")
      .withQueryStringParameters(params: _*)
      .get().map { r =>
      (r.json \ "response" \ "docs").as[Seq[Match]]
    }
  }

  def index() = Action { implicit request: Request[AnyContent] =>
    Ok(views.html.index())
  }

  def find(text: String): Action[AnyContent] = Action.async { implicit request =>
    query(text).map { docs =>
      Ok(Json.toJson(docs))
    }
  }

  private val transformFlow: Flow[String, (String, Seq[Match]), NotUsed] = Flow[String]
    .filter(_.nonEmpty)
    .mapAsync(1)(s => query(s).map(results => s -> results))


  def bodyParser: BodyParser[Source[ByteString, _]] = BodyParser { _ =>
    // Chunk incoming bytes by newlines, truncating them if the lines
    // are longer than 1000 bytes...
    val f = Flow[ByteString]
      .via(Framing.delimiter(ByteString("\n"), 1000, allowTruncation = true))
      .map(bs => bs.utf8String)
      .via(transformFlow)
      .flatMapConcat { case (s, results) => Source(results.map(r => s -> r).toList) }
      .map { case (s, r) =>
        s"$s,${r.id},${r.name},${r.countryCode},${r.lat},${r.lng},${r.fcl}\n"
      }
      .map(s => ByteString(s))

    Accumulator.source[ByteString]
    .map(_.via(f))
    .map(Right.apply)
  }

  def findPost: Action[Source[ByteString, _]] = Action(bodyParser) { implicit request =>
    Ok.chunked(request.body).as("text/csv")
  }

  def findWS: WebSocket = WebSocket.accept[String, String] { request =>
    Flow[String].flatMapConcat(s => Source(s.split("\n").toList))
      .via(transformFlow)
      .map { case (s, m) =>
        Json.stringify(Json.toJson(s -> m))
      }
  }
}

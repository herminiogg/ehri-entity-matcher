package models

import play.api.libs.json.{Format, Json}

import java.net.URI

case class Match(
  label: String,
  termLabel: String,
  language: String,
  term: URI,
  confidence: Double
) {
  def toCsv: Seq[String] = Seq(
    label,
    termLabel,
    language,
    term.toString,
    confidence.toString
  )
}

object Match {
  implicit val format: Format[Match] = Json.format[Match]
}


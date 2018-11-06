package models

import play.api.libs.json.{Format, Json}

case class Match(
  id: String,
  name: String,
  `type`: String,
  alternateNames: Option[Seq[String]],
  countryCode: Option[String] = None,
  country: Option[String] = None,
  lat: Option[BigDecimal] = None,
  lng: Option[BigDecimal] = None,
  fcl: Option[String] = None
)

object Match {
  implicit val format: Format[Match] = Json.format[Match]
}


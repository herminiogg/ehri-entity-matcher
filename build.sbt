name := """emt"""
organization := "eu.ehri.project"

version := "1.0-SNAPSHOT"

lazy val root = (project in file(".")).enablePlugins(PlayScala, SbtWeb)

scalaVersion := "2.12.6"

libraryDependencies += guice
libraryDependencies += ws
libraryDependencies += "com.typesafe.play" %% "play-json" % "2.6.10"
libraryDependencies += "com.fasterxml.jackson.dataformat" % "jackson-dataformat-csv" % "2.8.8"
libraryDependencies += "org.scalatestplus.play" %% "scalatestplus-play" % "3.1.2" % Test

// Adds additional packages into Twirl
//TwirlKeys.templateImports += "eu.ehri.project.controllers._"

// Adds additional packages into conf/routes
// play.sbt.routes.RoutesKeys.routesImport += "eu.ehri.project.binders._"

pipelineStages := Seq(digest)

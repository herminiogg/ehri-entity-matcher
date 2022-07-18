import com.typesafe.sbt.packager.MappingsHelper.directory

name := "emt"
organization := "eu.ehri_project"

version := "1.0-SNAPSHOT"

lazy val root = (project in file("."))
  .enablePlugins(PlayScala, SbtWeb, LauncherJarPlugin)

scalaVersion := "2.13.8"

libraryDependencies += guice
libraryDependencies += ws
libraryDependencies += "com.typesafe.play" %% "play-json" % "2.8.2"
libraryDependencies += "com.fasterxml.jackson.dataformat" % "jackson-dataformat-csv" % "2.11.4"
libraryDependencies += "org.scalatestplus.play" %% "scalatestplus-play" % "5.1.0" % Test
libraryDependencies += "com.herminiogarcia" %% "label2thesaurus" % "0.1.0"

// Adds additional packages into Twirl
//TwirlKeys.templateImports += "eu.ehri.project.controllers._"

// Adds additional packages into conf/routes
// play.sbt.routes.RoutesKeys.routesImport += "eu.ehri.project.binders._"

pipelineStages := Seq(digest)

// Dist options
topLevelDirectory := None

mappings in Universal ++= directory("bin")

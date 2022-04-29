#!/bin/bash

file=$1

core='emt'

separator='separator=%09'
encapsulator='&encapsulator=%00' # %00 disables encapsulation. Default is '"'

header='&header=false'

fieldnames='&fieldnames='
fieldnames="${fieldnames}id,name,asciiName,alternateNames,lat,lng"
fieldnames="${fieldnames},fcl,fcode,countryCode"
fieldnames="${fieldnames},cc2,adm1,adm2,adm3,adm4"
fieldnames="${fieldnames},population,elevation,dem,timezone"
#fieldnames="${fieldnames},date_modified"
fieldnames="${fieldnames},ancestors,hcode"

multivalued="&f.alternateNames.split=true&f.alternateNames.separator=%2C" # comma (,)
multivalued="$multivalued&f.cc2.split=true&f.cc2.separator=%2C" # comma (,)
multivalued="$multivalued&f.ancestors.split=true&f.ancestors.separator=%2C" # comma (,)

literal="&literal.type=Place"

wt='&wt=json'

params="${separator}${encapsulator}${header}${fieldnames}${multivalued}${literal}${wt}"

curl -X POST "localhost:8984/solr/${core}/update?${params}&commit=true" -H 'Accept:application/json' -H 'Content-Type:application/csv' -T $file

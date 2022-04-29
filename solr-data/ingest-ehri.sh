#!/bin/bash

file=$1

core='emt'

#separator='separator=%2C' # comma (,)
#separator='separator=%09' # tab
#encapsulator='&encapsulator=%22' # %00 disables encapsulation. Default is '"'
#
#header='&header=false'
#
#fieldnames='&fieldnames='
#fieldnames="${fieldnames}id,type,name,alternateNames,lat,lng,countryCode"
#
#multivalued="&f.alternateNames.split=true&f.alternateNames.separator=%7C" # pipe (|)
#
#wt='&wt=json'
#
#params="${separator}${encapsulator}${header}${fieldnames}${multivalued}${wt}"

#curl -X POST "localhost:8984/solr/${core}/update?${params}&commit=true" -H 'Accept:application/json' -H 'Content-Type:application/csv' --data-binary @$file
curl -X POST "localhost:8984/solr/${core}/update?&commit=true" -H 'Accept:application/json' -H 'Content-Type:application/json' --data-binary @$file

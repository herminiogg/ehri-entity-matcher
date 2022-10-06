EHRI Vocabularies Matching Tool
=========================

A small (prototype) single page app which translating a list of textual references to controlled vocabulary items,
using different string similarity algorithms. The tool allows you to parametrise these algorithms to reach the
best results for your use case. Then, the selected results can be exported to CSV or TSV, which in case of
the TSV export it can be directly uploaded to the EHRI portal to build a coreference table.

![Screenshot](screen.png)

## Dependencies

This application strongly relies on the label2thesaurus library (https://github.com/herminiogg/label2thesaurus) that, 
on its side, wraps vickumar1981's string distance calculation library (https://github.com/vickumar1981/stringdistance) 
for using it over SKOS vocabularies.
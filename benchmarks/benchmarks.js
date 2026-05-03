/*
   Copyright 2026 Shko Online LLC <sales@shko.online>

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
 */

const stringToParse = "{&quot;Range&quot;:&quot;A1:I2&quot;,&quot;Columns&quot;:{&quot;(Do Not Modify) Account&quot;:{&quot;DisplayName&quot;:&quot;(Do Not Modify) Account&quot;,&quot;ColumnIndex&quot;:0,&quot;LogicalName&quot;:&quot;accountid&quot;},&quot;(Do Not Modify) Row Checksum&quot;:{&quot;DisplayName&quot;:&quot;(Do Not Modify) Row Checksum&quot;,&quot;ColumnIndex&quot;:1,&quot;LogicalName&quot;:&quot;checksumLogicalName&quot;},&quot;(Do Not Modify) Modified On&quot;:{&quot;DisplayName&quot;:&quot;(Do Not Modify) Modified On&quot;,&quot;ColumnIndex&quot;:2,&quot;LogicalName&quot;:&quot;modifiedon&quot;},&quot;Account Name&quot;:{&quot;DisplayName&quot;:&quot;Account Name&quot;,&quot;ColumnIndex&quot;:3,&quot;LogicalName&quot;:&quot;name&quot;},&quot;Main Phone&quot;:{&quot;DisplayName&quot;:&quot;Main Phone&quot;,&quot;ColumnIndex&quot;:4,&quot;LogicalName&quot;:&quot;telephone1&quot;},&quot;Address 1: City&quot;:{&quot;DisplayName&quot;:&quot;Address 1: City&quot;,&quot;ColumnIndex&quot;:5,&quot;LogicalName&quot;:&quot;address1_city&quot;},&quot;Primary Contact&quot;:{&quot;DisplayName&quot;:&quot;Primary Contact&quot;,&quot;ColumnIndex&quot;:6,&quot;LogicalName&quot;:&quot;primarycontactid&quot;},&quot;Email (Primary Contact) (Contact)&quot;:{&quot;DisplayName&quot;:&quot;Email (Primary Contact) (Contact)&quot;,&quot;ColumnIndex&quot;:7,&quot;LogicalName&quot;:&quot;7befeabe-bf01-4207-97f8-7a96e05d2332.emailaddress1&quot;},&quot;Status&quot;:{&quot;DisplayName&quot;:&quot;Status&quot;,&quot;ColumnIndex&quot;:8,&quot;LogicalName&quot;:&quot;statecode&quot;}},&quot;DisplayConditions&quot;:&quot;\u003cDisplayConditions\u003e\u003cEveryone /\u003e\u003c/DisplayConditions\u003e&quot;}";

const suite = new Benchmark.Suite;
suite.add("DOMParser#test",function(){
(new DOMParser()).parseFromString(stringToParse,"text/html").documentElement.textContent

})
.add("he#test",function(){
    he.decode(stringToParse);
})
.add("DocumentElement#test", function(){
  var element =   document.createElement("test");
  element.innerHTML = stringToParse;
  element.innerText;
}).on("cycle",function(e){
    console.log(String(e.target));
}).on("complete",function(){
    console.log("Fastest is "+ this.filter('fastest').map("name"));
}).run({'async': true});
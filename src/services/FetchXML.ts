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

export class FetchXML {
    private readonly document: XMLDocument;
    readonly fetchElement: HTMLElement;
    readonly entityElement: HTMLElement;

    constructor(entity: string){
        this.document = new DOMParser().parseFromString("<fetch />", "application/xml");
        this.fetchElement = this.document.documentElement;
        this.entityElement = this.document.createElement("entity");
        this.entityElement.setAttribute("name", entity);
        this.fetchElement.appendChild(this.entityElement);
    }

    public addAttribute(name:string, alias?:string){
        const attribute = this.document.createElement("attribute");
        attribute.setAttribute("name", name); 
        if(alias){
            attribute.setAttribute("alias", alias);
        }
        this.entityElement.appendChild(attribute);
        return attribute;
    }

    public addAttributes(...values: string[]){
        values.forEach(name=>{
            this.addAttribute(name);
        });
    }

    public addFilter(type?: "Or" | "And"){
        const filter = this.document.createElement("filter");
        if(type){
            filter.setAttribute("type", type);
        }
        this.entityElement.appendChild(filter);
        return new FetchFilter(filter);
    }

    public toString(){
        return this.document.documentElement.outerHTML;
    }
}

class FetchFilter {
    private readonly document: XMLDocument;
    readonly filterElement: HTMLElement;
    constructor(filterElement: HTMLElement){
        this.document = filterElement.ownerDocument;
        this.filterElement = filterElement;
    }

    public addFilter(type?: "Or" | "And"){
        const filter = this.document.createElement("filter");
        if(type){
            filter.setAttribute("type", type);
        }
        this.filterElement.appendChild(filter);
        return new FetchFilter(filter);
    }

    public addCondition(attribute:string, operator: "eq", value?: string){
        const condition = this.document.createElement("condition");
        condition.setAttribute("attribute", attribute);
        condition.setAttribute("operator", operator);
        if(value!==undefined){
            condition.setAttribute("value", value);
        }
        this.filterElement.appendChild(condition);
        return condition;
    }

    public addInCondition(attribute:string, operator: "in", values: string[]){
        const condition = this.document.createElement("condition");
        condition.setAttribute("attribute", attribute);
        condition.setAttribute("operator", operator);
        values.forEach(value=>{
            const valueElement = this.document.createElement("value");
            valueElement.innerHTML=value;
            condition.appendChild(valueElement);
        });
        this.filterElement.appendChild(condition);
        return condition;
    }
}
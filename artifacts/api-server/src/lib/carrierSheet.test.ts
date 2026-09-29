import { test } from "node:test";
import { strict as assert } from "node:assert";
import { parseCsv, parseSheet } from "./carrierSheet.ts";

test("CSV parser handles embedded commas, quotes and multiline fields", () => {
  assert.deepEqual(parseCsv('A,B\r\n"One, ""two""\nthree",Four\r\n'), [
    ["A", "B"], ['One, "two"\nthree', "Four"],
  ]);
});

test("sheet records retain source cells and only literal tags", () => {
  const catalog = parseSheet(
    'Particle Type,Refrence,Composition,Mechanism,Advantages,Limitations,Methodology\n' +
    '"LNP","Cystic fibrosis inhaled mRNA study","Optimized carrier: 2.5% CAS-LNP.","Escape","Useful","Some limitation","Nebulized administration"\n' +
    '"LNP","General delivery","Other material","No route or disease","Unclear","Pulmonary fibrosis noted only as a limitation","Experimental"\n'
  );
  assert.equal(catalog.records.length, 2);
  assert.equal(catalog.records[0].formulation_name, "2.5% CAS-LNP");
  assert.deepEqual(catalog.records[0].diseases, ["Cystic fibrosis"]);
  assert.deepEqual(catalog.records[0].routes, ["Inhalation"]);
  assert.deepEqual(catalog.records[0].cargos, ["mRNA"]);
  assert.equal(catalog.records[0].row, 2);
  assert.match(catalog.records[0].source_url, /#range=A2:G2$/);
  assert.deepEqual(catalog.records[1].diseases, []);
  assert.deepEqual(catalog.records[1].routes, []);
});

test("changed sheet columns fail rather than returning misleading results", () => {
  assert.throws(() => parseSheet("Type,Ref,Composition\nLNP,Reference,Material"), /columns have changed/);
});
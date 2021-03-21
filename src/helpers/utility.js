import { Table } from "apache-arrow";

export async function loadArrowTable(file) {
  let results = await Table.from(fetch(file));
  let table = await results;
  return results;
}

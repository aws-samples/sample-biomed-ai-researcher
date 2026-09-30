// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import h from './data/data_headers.json';
const headers: any = h;

export async function restructureTableData(data: any) {
  //Nests subquestions (1a, 1b, ...) to the "children" value of its parent question
  let newData = [];
  for (let i = 0; i < data.length; i++) {
    let q = data[i].question;

    let prefix = q.match(/^\d\w*\./);
    if (prefix !== null) {
      prefix = prefix[0].replace(/\./, ''); //"4 or 4a"
      let prefixLetter = prefix.replace(/\d+/g, '').replace('.', ''); //"a"
      if (!prefixLetter) {
        newData.push({ ...data[i], children: [] });
      }
    }
  }
  for (let n = 0; n <= newData.length; n++) {
    for (let i = 0; i < data.length; i++) {
      let q = data[i].question;
      let prefix = q.match(/^\d\w*\./);

      if (prefix !== null) {
        prefix = prefix[0].replace(/\./, ''); //"4 or 4a"
        let prefixNumber = prefix.replace(/[a-zA-Z]?/g, ''); //"4"
        let prefixLetter = prefix.replace(/\d+/g, '').replace('.', ''); //"a"

        if (prefixLetter && prefixNumber == n) {
          let subquestion = data[i];
          subquestion.header = headers[prefix];
          newData[n - 1].children.push({
            marker: prefix,
            ...subquestion,
          });
        }
      }
    }
  }

  return newData;
}

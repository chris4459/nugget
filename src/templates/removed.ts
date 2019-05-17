export = `
<details>
  <summary>:wastebasket: ({{this.length}}) Packages Removed</summary>
  <table>
    <tr>
      <th>Package</th>
      <th>Version(s)</th>
    </tr>
    {{#each this as |pkg key|}}
    <tr>
      <td>{{pkg.[0]}}</td>
      <td>
        {{#each pkg.[1].versions as |version|}}
        <code>{{version}}</code>
        {{/each}}
      </td>
    </tr>
    {{/each}}
  </table>
</details>
`;

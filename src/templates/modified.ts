export = `
<details>
  <summary>:hammer_and_wrench: ({{this.length}}) Packages Modified</summary>
  <p></p>
  <table>
    <tr>
      <th>Package</th>
      <th>Version(s)</th>
      <th>Existing Version(s)</th>
    </tr>
    {{#each this as |pkg|}}
    <tr>
      <td>{{pkg.pkgName}}</td>
      <td>
        {{#each pkg.removedVersions as |version|}}
        <del><code>{{version}}</code></del>
        {{/each}}
        {{#each pkg.addedVersions as |version|}}
        <code>{{version}}</code>
        {{/each}}
      </td>
      <td>
        {{#each pkg.existingVersions as |version|}}
        <code>{{version}}</code>
        {{/each}}
      </td>
    </tr>
    {{/each}}
  </table>
</details>
`;

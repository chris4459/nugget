import {compile} from 'handlebars';
import {difference, find, intersection, isEmpty, isUndefined} from 'lodash';
import {Application, Context} from 'probot';
import {ISerializedPackage} from './lockfile';
import * as templates from './templates';

export const getCommentFromNugget = async (
  context: Context,
  app: Application
) => {
  const {issue_number: issueNumber, owner, repo} = context.issue();

  const github = await app.auth();
  const githubApp = await github.apps.getAuthenticated({});
  const githubAppName = githubApp.data.name;

  // Get all comments for issue
  const comments = await context.octokit.issues.listComments({
    issue_number: issueNumber,
    owner,
    repo,
  });

  // Find comment made from nugget)
  return find(comments.data, comment => {
    const user = comment.user;
    return user.login === `${githubAppName}[bot]` && user.type === 'Bot';
  });
};

/**
 * If a comment is already made by Nugget, update the comment with `body`
 * Else create a new comment with `body`
 * @param context
 * @param body
 */
export const createComment = async (
  context: Context,
  app: Application,
  body: string
) => {
  const {issue_number: issueNumber, owner, repo} = context.issue();

  const nuggetComment = await getCommentFromNugget(context, app);

  // Create/update comment
  if (!isUndefined(nuggetComment)) {
    await context.octokit.issues.updateComment({
      body,
      comment_id: nuggetComment.id,
      owner,
      repo,
    });
  } else {
    await context.octokit.issues.createComment({
      body,
      issue_number: issueNumber,
      owner,
      repo,
    });
  }
};

const parseSerializedLockfiles = (
  baseLf: Map<string, ISerializedPackage>,
  newLf: Map<string, ISerializedPackage>
) => {
  const data: {[key: string]: any} = {added: [], modified: [], removed: []};

  // Grab iterators
  const baseLfIt = baseLf[Symbol.iterator]();
  const newLfIt = newLf[Symbol.iterator]();

  // First entries
  let baseEntry = baseLfIt.next();
  let newEntry = newLfIt.next();

  while (!baseEntry.done && !newEntry.done) {
    const [basePkg, basePkgData] = baseEntry.value;
    const [newPkg, newPkgData] = newEntry.value;

    if (basePkg === newPkg) {
      /* same pkg */
      const removedVersions = difference(
        basePkgData.versions,
        newPkgData.versions
      );
      const addedVersions = difference(
        newPkgData.versions,
        basePkgData.versions
      );

      if (!isEmpty(removedVersions) || !isEmpty(addedVersions)) {
        const existingVersions = intersection(
          newPkgData.versions,
          basePkgData.versions
        );

        data.modified.push({
          addedVersions,
          existingVersions,
          pkgName: basePkg,
          removedVersions,
        });
      }

      baseEntry = baseLfIt.next();
      newEntry = newLfIt.next();
    } else if (basePkg < newPkg) {
      /* pkg removed */
      data.removed.push(baseEntry.value);
      baseEntry = baseLfIt.next();
    } else {
      /* pkg added */
      data.added.push(newEntry.value);
      newEntry = newLfIt.next();
    }
  }

  while (!baseEntry.done) {
    /* pkg removed */
    data.removed.push(baseEntry.value);
    baseEntry = baseLfIt.next();
  }

  while (!newEntry.done) {
    /* pkg added */
    data.added.push(newEntry.value);
    newEntry = newLfIt.next();
  }

  return data;
};

/**
 * Given a serialized base and new lockfile create a comment body to post
 *
 * @param baseLf Serialized base lockfile
 * @param newLf Serialized new lockfile
 */
export const createCommentBody = (
  baseLf: Map<string, ISerializedPackage>,
  newLf: Map<string, ISerializedPackage>
): string => {
  const {added, modified, removed} = parseSerializedLockfiles(baseLf, newLf);

  let commentBody = ':cat2: Nugget noticed a `yarn.lock` file change ';

  if (isEmpty(added) && isEmpty(modified) && isEmpty(removed)) {
    commentBody +=
      'but reports that there are no actual package version changes.\n\n\
This *usually* means a new version range was added/removed to your `yarn.lock` \
that got resolved to an existing version using \
[semantic versioning (semver)](https://semver.org/).\n\n';

    return commentBody;
  }

  commentBody += 'and reports the following package version changes:\n\n';

  commentBody += !isEmpty(added) ? compile(templates.addedTmpl)(added) : '';
  commentBody += !isEmpty(modified)
    ? compile(templates.modifiedTmpl)(modified)
    : '';
  commentBody += !isEmpty(removed)
    ? compile(templates.removedTmpl)(removed)
    : '';

  commentBody += '\n---\n\n### What is :cat2: Nugget telling you?\n';
  commentBody += !isEmpty(added)
    ? ':heavy_plus_sign: **Packages Added**: What new *package* has been added?\n\n'
    : '';
  commentBody += !isEmpty(modified)
    ? ':hammer_and_wrench: **Packages Modified**: What *version* has been added/removed to an existing *package*?\n\
`x.y.z` = version added || ~`x.y.z`~ = version removed\n\
*Existing versions* is a helpful indication of what other versions are still installed.\n\n'
    : '';
  commentBody += !isEmpty(removed)
    ? ':wastebasket: **Packages Removed**: What *package* has been entirely removed from your project?\n'
    : '';

  return commentBody;
};

export const createTooManyFilesCommentBody = (): string => {
  return ':cat2: Nugget noticed that there are more than 3000 file changes.\
  The [github api](https://developer.github.com/v3/pulls/#list-pull-requests-files) only supports listing a maximum\
  of 3000 files. Thus there may have been a `yarn.lock` file change that Nugget couldn\'t detect.'
}
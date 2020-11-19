import {Router} from 'express';
import {get, isUndefined} from 'lodash';
import {Application, Context} from 'probot';
import {
  createComment,
  createCommentBody,
  createTooManyFilesCommentBody,
  getCommentFromNugget,
} from './comment';
import {getLockfileChange, getSerializedLockFile, ILockfileData, LockfileStatus} from './lockfile';

export = ({app, getRouter}: {app: Application, getRouter: () => Router}) => {

  const router = getRouter();

  router.get('/healthcheck', (req: any, res: any) => {
    res.send(`OK`);
  });

  app.on(
    ['pull_request.opened', 'pull_request.synchronize'],
    async (context: Context) => {
      const {issue_number: issueNumber, owner, repo} = context.issue();
      const contextId = `[${owner}/${repo}/${issueNumber}]`;

      // Check if there is a lockfile change
      const {status, data: lockfileData}: ILockfileData = await getLockfileChange(context);
      if (status === LockfileStatus.NotFound) {
        app.log(`${contextId} No yarn.lock change found`);

        const nuggetComment = await getCommentFromNugget(context, app);

        if (!isUndefined(nuggetComment)) {
          app.log(`${contextId} Deleting existing nugget comment`);
          await context.octokit.issues.deleteComment({
            comment_id: nuggetComment.id,
            owner,
            repo,
          });
        }

        return;
      }

      if (status === LockfileStatus.TooManyFiles) {
        app.log(`${contextId} Too many files in pull request`);

        const nuggetComment = await getCommentFromNugget(context, app);

        if (!isUndefined(nuggetComment)) {
          app.log(`${contextId} Deleting existing nugget comment`);
          await context.octokit.issues.deleteComment({
            comment_id: nuggetComment.id,
            owner,
            repo,
          });
        }

        const tooManyFilesCommentBody = createTooManyFilesCommentBody();
        await createComment(context, app, tooManyFilesCommentBody);
        return;
      }

      app.log(`${contextId} Detected yarn.lock change`);

      // Serialize changed lockfile
      const newLf = await getSerializedLockFile(lockfileData.raw_url);

      // Serialize base ref lockfile
      let baseLf;
      try {
        const baseContent = await context.octokit.repos.getContent({
          owner,
          path: 'yarn.lock',
          ref: get(context.payload, ['pull_request', 'base', 'ref'], 'master'),
          repo,
        });

        baseLf = await getSerializedLockFile(baseContent.data.download_url);
      } catch (error) {
        app.log(`${contextId} No yarn.lock found in base ref`);
        baseLf = new Map();
      }

      // Create comment body
      const commentBody = createCommentBody(baseLf, newLf);

      // Report differences
      await createComment(context, app, commentBody);
    }
  );
};

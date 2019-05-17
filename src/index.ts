import {get, isUndefined} from 'lodash';
import {Application, Context} from 'probot';
import {
  createComment,
  createCommentBody,
  getCommentFromNugget,
} from './comment';
import {getLockfileChange, getSerializedLockFile} from './lockfile';

export = (app: Application) => {
  app.on(
    ['pull_request.opened', 'pull_request.synchronize'],
    async (context: Context) => {
      const {number: issueNumber, owner, repo} = context.issue();
      const contextId = `[${owner}/${repo}/${issueNumber}]`;

      // Check if there is a lockfile change
      const lockfileData = await getLockfileChange(context);
      if (!lockfileData) {
        app.log(contextId, 'No yarn.lock change found');

        const nuggetComment = await getCommentFromNugget(context, app);

        if (!isUndefined(nuggetComment)) {
          app.log(contextId, 'Deleting existing nugget comment');
          await context.github.issues.deleteComment({
            comment_id: nuggetComment.id,
            owner,
            repo,
          });
        }

        return;
      }

      app.log(contextId, 'Detected yarn.lock change');

      // Serialize changed lockfile
      const newLf = await getSerializedLockFile(lockfileData.raw_url);

      // Serialize base ref lockfile
      let baseLf;
      try {
        const baseContent = await context.github.repos.getContents({
          owner,
          path: 'yarn.lock',
          ref: get(context.payload, ['pull_request', 'base', 'ref'], 'master'),
          repo,
        });

        baseLf = await getSerializedLockFile(baseContent.data.download_url);
      } catch (error) {
        app.log(contextId, 'No yarn.lock found in base ref');
        baseLf = new Map();
      }

      // Create comment body
      const commentBody = createCommentBody(baseLf, newLf);

      // Report differences
      await createComment(context, app, commentBody);
    }
  );
};

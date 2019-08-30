# nugget

> A GitHub App built with [Probot](https://github.com/probot/probot) that diffs yarn lockfile changes on pull requests and creates a simple visualization of the diffs.

## Who is Nugget?
Nugget is my pet cat :cat2: and I'd like to believe in the web development world, Nugget likes to play with yarn lockfiles.

![Nugget](/images/nugget.jpg)

## Motivation
Ever been annoyed at how a `yarn.lock` file can potentially have a large diff and produce PRs with the following visual:
![Lockfile Diff Too Large](/images/lockfile-diff-too-large.png)

and upon loading the diff
- your browser slows down
- you have to scroll _forever_
- it's pretty much impossible to verify all version changes if not any
![Lockfile Infinite Scroll](/images/lockfile-scroll.gif)

A common case where such large diffs from lockfiles are generated are from [Renovate](https://renovatebot.com/)'s [lockfile maintenance](https://renovatebot.com/docs/configuration-options/#lockfilemaintenance) or from having to do a clean install for some reason. Regardless it is difficult to understand all the packages being added, removed, and package versions being modified.

Why couldn't there be a webhook that detects a `yarn.lock` change and parses the lockfile to generate a table visualization that summarizes the lockfile diff? And so I introduce Nugget!

> _Nugget is **NOT** meant to be a replacement for reviewing yarn lockfile changes. It is merely a simple visualization of the lockfile diff and a tool to be more confident of any lockfile changes._

## What does Nugget do?
After detecting and parsing a `yarn.lock` diff in your pull request, Nugget categorizes package changes into three groups:
- _Packages Added_
  - What new package has been added?
- _Packages Modified_
  - What version has been added/removed/updated to an existing package?
  - If applicable, what existing versions are still installed?
- _Packages Removed_
  - What package has been removed?

Here's an example comment that Nugget will post
![Nugget Example Comment](/images/nugget-comment-example.png)

## Contributing

If you have suggestions for how nugget could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

[ISC](LICENSE) © 2019 Chris Lee <chl@umich.edu>

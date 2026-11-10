/* Select published Pages commits and the last successful IndexNow checkpoint. */

async function publishedRevisions(github, repo) {
  const commits = [];
  const deployments = github.paginate.iterator(github.rest.repos.listDeployments, {
    ...repo,
    environment: 'github-pages',
    ref: 'main',
    per_page: 30,
  });

  // A rerun of an old Pages workflow creates a new deployment of that old SHA.
  // Deployment records therefore describe rollbacks better than workflow run IDs.
  for await (const {data} of deployments) {
    for (const deployment of data) {
      const {data: statuses} = await github.rest.repos.listDeploymentStatuses({
        ...repo,
        deployment_id: deployment.id,
        per_page: 1,
      });
      if (!['success', 'inactive'].includes(statuses[0]?.state)) continue;
      if (commits.includes(deployment.sha)) continue;
      commits.push(deployment.sha);
      if (commits.length === 2) return commits;
    }
  }
  return commits;
}

module.exports = async function resolveRevisions({github, context, core}) {
  const [after, previous = after] = await publishedRevisions(github, context.repo);
  if (!after) throw new Error('No successful Pages deployment found.');

  if (context.eventName === 'workflow_run' && context.payload.workflow_run.head_sha !== after) {
    core.info('Another revision has already been published; skipping this deployment.');
    return;
  }

  core.setOutput('after', after);
  core.setOutput('before', previous);

  const artifacts = github.paginate.iterator(github.rest.actions.listArtifactsForRepo, {
    ...context.repo,
    name: 'indexnow-checkpoint',
    per_page: 100,
  });
  for await (const {data} of artifacts) {
    for (const artifact of data) {
      if (artifact.expired || artifact.workflow_run?.head_branch !== 'main') continue;

      // Other workflows must not supply this workflow's publication checkpoint.
      const {data: run} = await github.rest.actions.getWorkflowRun({
        ...context.repo,
        run_id: artifact.workflow_run.id,
      });
      if (run.path !== '.github/workflows/indexnow.yml') continue;
      core.setOutput('checkpoint-run', artifact.workflow_run.id);
      return;
    }
  }
};

const assert = require('node:assert/strict');
const test = require('node:test');
const resolveRevisions = require('../scripts/indexnow-revisions.cjs');

function fixture({deployments = [], statuses = {}, artifacts = [], runPaths = {}, eventSha} = {}) {
  const outputs = {};
  const messages = [];
  const calls = [];
  const repos = {
    listDeployments() {},
    async listDeploymentStatuses({deployment_id}) {
      return {data: [{state: statuses[deployment_id] || 'success'}]};
    },
  };
  const actions = {
    listArtifactsForRepo() {},
    async getWorkflowRun({run_id}) {
      return {data: {path: runPaths[run_id] || '.github/workflows/indexnow.yml'}};
    },
  };
  const github = {
    rest: {repos, actions},
    paginate: {
      async *iterator(method, options) {
        calls.push({method, options});
        if (method === repos.listDeployments) {
          assert.equal(options.environment, 'github-pages');
          assert.equal(options.ref, 'main');
          for (const page of deployments) yield {data: page};
        } else if (method === actions.listArtifactsForRepo) {
          // Octokit normalizes the REST {total_count, artifacts} object to an array.
          for (const page of artifacts) yield {data: page};
        } else {
          throw new Error('Unexpected paginated API');
        }
      },
    },
  };
  const context = {
    repo: {owner: 'litovle', repo: 'litovle.cz'},
    eventName: eventSha ? 'workflow_run' : 'workflow_dispatch',
    payload: {workflow_run: {head_sha: eventSha}},
  };
  const core = {
    setOutput: (key, value) => { outputs[key] = value; },
    info: message => messages.push(message),
  };
  return {run: () => resolveRevisions({github, context, core}), outputs, messages, calls};
}

test('only successful distinct published revisions are compared, across API pages', async () => {
  const {run, outputs} = fixture({
    deployments: [
      [{id: 5, sha: 'pending'}, {id: 4, sha: 'failed'}],
      [{id: 3, sha: 'current'}, {id: 2, sha: 'current'}, {id: 1, sha: 'previous'}],
    ],
    statuses: {5: 'in_progress', 4: 'failure', 1: 'inactive'},
  });
  await run();
  assert.deepEqual(outputs, {after: 'current', before: 'previous'});
});

test('a newly published rollback is processed even when its workflow run is old', async () => {
  const {run, outputs} = fixture({
    deployments: [[{id: 3, sha: 'old-source'}, {id: 2, sha: 'new-source'}]],
    eventSha: 'old-source',
  });
  await run();
  assert.deepEqual(outputs, {after: 'old-source', before: 'new-source'});
});

test('a delayed event for a superseded deployment is skipped', async () => {
  const {run, outputs, messages, calls} = fixture({
    deployments: [[{id: 2, sha: 'current'}, {id: 1, sha: 'superseded'}]],
    eventSha: 'superseded',
  });
  await run();
  assert.deepEqual(outputs, {});
  assert.equal(messages.length, 1);
  assert.equal(calls.length, 1, 'checkpoint lookup should also be skipped');
});

test('the first publication establishes a baseline', async () => {
  const {run, outputs} = fixture({deployments: [[{id: 1, sha: 'first'}]]});
  await run();
  assert.deepEqual(outputs, {after: 'first', before: 'first'});
});

test('missing successful publications fail before setting submission outputs', async () => {
  const {run, outputs} = fixture({
    deployments: [[{id: 1, sha: 'failed'}]], statuses: {1: 'failure'},
  });
  await assert.rejects(run, /No successful Pages deployment/);
  assert.deepEqual(outputs, {});
});

test('checkpoint recovery rejects expired, branch and other-workflow artifacts', async () => {
  const checkpoint = (id, head_branch = 'main') => ({
    expired: false, workflow_run: {id, head_branch},
  });
  const {run, outputs} = fixture({
    deployments: [[{id: 1, sha: 'published'}]],
    artifacts: [
      [{...checkpoint(5), expired: true}, checkpoint(4, 'feature'), checkpoint(3)],
      [checkpoint(2)],
    ],
    runPaths: {3: '.github/workflows/other.yml'},
  });
  await run();
  assert.equal(outputs['checkpoint-run'], 2);
});

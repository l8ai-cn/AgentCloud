# Platform Identity Boundary

Course files and platform publication are separate completion surfaces.

## Artifact-Only Build

The worker can always create and validate `artifacts/course-package.json`. This result
is useful for review and later publication, but it is not a platform course.

## Credentialed Publication

Publication requires both:

- an explicit course API base URL for the intended environment;
- a current teacher-scoped bearer token supplied to the course package CLI.

Never use a browser cookie, organization administration key, guessed tenant, static
shared teacher identity, or another environment's token.

The only valid success evidence is:

1. exact column resolution from `GET /columns`;
2. Git source response from `POST /courses/git-source`;
3. returned course id from `POST /courses`;
4. successful `POST /courses/{id}/publish`;
5. `GET /courses/{id}` with the expected Git source and non-empty published commit;
6. `GET /courses/{id}/outline?format=json&include_content=true` with the expected tree.

Any missing repository, missing commit, ambiguous column, credential failure, or empty
outline is a failed publication. Do not create substitute content or claim success.

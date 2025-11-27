# Fathom API

## Docs

- [null](https://developers.fathom.ai/api-overview.md)
- [List meetings](https://developers.fathom.ai/api-reference/meetings/list-meetings.md)
- [Get summary](https://developers.fathom.ai/api-reference/recordings/get-summary.md): This endpoint has two behaviors depending on your request payload:
- If you send `destination_url`, the endpoint will behave in an asynchronous manner.
- If you do not send `destination_url`, the endpoint will return the data directly.

- [Get transcript](https://developers.fathom.ai/api-reference/recordings/get-transcript.md): This endpoint has two behaviors depending on your request payload:
- If you send `destination_url`, the endpoint will behave in an asynchronous manner.
- If you do not send `destination_url`, the endpoint will return the data directly.

- [List team members](https://developers.fathom.ai/api-reference/team-members/list-team-members.md)
- [List teams](https://developers.fathom.ai/api-reference/teams/list-teams.md)
- [New meeting content ready](https://developers.fathom.ai/api-reference/webhook-payloads/new-meeting-content-ready.md): Webhook sent to the URL you register in Fathom settings.
- [Create a webhook](https://developers.fathom.ai/api-reference/webhooks/create-a-webhook.md): Create a webhook to receive new meeting content.
At least one of `include_transcript`, `include_crm_matches`, `include_summary`, or `include_action_items` must be true.

- [Delete a webhook](https://developers.fathom.ai/api-reference/webhooks/delete-a-webhook.md): Delete a webhook.
- [Introduction](https://developers.fathom.ai/index.md): Welcome to Fathom's API! 🚀
- [💡 Get Inspired](https://developers.fathom.ai/inspiration/index.md): Peek at what others have built—and spark your own next project.
- [Pylon](https://developers.fathom.ai/inspiration/pylon.md): How Pylon uses Fathom to power AI-native customer support.
- [Twine](https://developers.fathom.ai/inspiration/twine.md): How Twine bring meeting insights into revenue workflows with the help of Fathom
- [Building with OAuth](https://developers.fathom.ai/oauth.md): Launching an integration with Fathom?
- [Quickstart](https://developers.fathom.ai/quickstart.md): Generate an API key and make your first call
- [Advanced Configuration](https://developers.fathom.ai/sdks/advanced-configuration.md): Advanced options and configurations for the Fathom SDKs
- [Authentication](https://developers.fathom.ai/sdks/authentication.md): Authenticate with the Fathom SDKs using API keys
- [Available Methods](https://developers.fathom.ai/sdks/available-methods.md): All available methods in the Fathom SDKs
- [Python SDK Changes](https://developers.fathom.ai/sdks/breaking-changes/python-changes.md): Breaking changes in Python SDK version 0.0.30
- [SDK Maturity](https://developers.fathom.ai/sdks/breaking-changes/sdk-maturity.md): Information about SDK maturity and version management
- [TypeScript SDK Changes](https://developers.fathom.ai/sdks/breaking-changes/typescript-changes.md): Breaking changes in TypeScript SDK version 0.0.30
- [Error Handling](https://developers.fathom.ai/sdks/error-handling.md): Handle errors with the Fathom SDKs
- [Filtering](https://developers.fathom.ai/sdks/filtering.md): Filter data with the Fathom SDKs
- [SDK Introduction](https://developers.fathom.ai/sdks/index.md): Get started with Fathom using our official TypeScript and Python SDKs
- [OAuth](https://developers.fathom.ai/sdks/oauth.md): Use OAuth authentication with the Fathom SDKs
- [Pagination](https://developers.fathom.ai/sdks/pagination.md): Handle paginated responses with the Fathom SDKs
- [Python Installation](https://developers.fathom.ai/sdks/python-installation.md): Install the Fathom Python SDK
- [TypeScript Installation](https://developers.fathom.ai/sdks/typescript-installation.md): Install the Fathom TypeScript SDK
- [Webhooks](https://developers.fathom.ai/webhooks.md): Automatically trigger webhook events after your meetings
- 
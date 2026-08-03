# WeCom Voice Transcription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Download WeCom archive voice media, transcribe short audio with Alibaba Cloud ISI, persist the text in PostgreSQL, and feed it into the existing construction-analysis pipeline.

**Architecture:** Extend the Finance SDK CLI with a chunked media-download command, preserve `sdkfileid` during message normalization, and create a bounded media worker that moves records through explicit database states. The worker uses a focused Alibaba Cloud client for token caching and the `/stream/v1/asr` request, then writes both the canonical transcript and an analysis-ready `messages.content` value.

**Tech Stack:** Node.js 22 ESM with built-in `fetch`/`crypto`, PostgreSQL 16, `pg`, Alibaba Cloud ISI REST API, WeCom Finance SDK C API, C++17, systemd.

## Global Constraints

- Production host is supplied through an approved SSH config alias; application root is `/opt/wecom-chat-pipeline`.
- PostgreSQL remains bound to localhost and the existing `wecom_pipeline` role remains non-superuser.
- Credentials live only in `/etc/wecom-chat-pipeline/secrets.env` with mode `0600`.
- ASR is disabled unless all required Alibaba Cloud settings are present.
- A failed media task must never block text-message collection or advance to `done`.
- Logs must not contain AccessKeys, tokens, `sdkfileid`, audio bytes, or transcript text.
- Existing six Node.js tests must continue to pass.
- Deployment must create restorable application, native-binary, and PostgreSQL backups before mutation.
- Process one voice at a time and delete its local audio immediately after the transcript and SHA-256 are committed.
- Do not install FFmpeg, a local ASR model, OSS integration, or an Alibaba Cloud SDK package.

---

### Task 1: Establish a Local, Coze-Managed Working Copy

**Files:**
- Create: `wecom-chat-pipeline/` from `/opt/wecom-chat-pipeline`
- Reference: `docs/superpowers/specs/2026-08-03-wecom-voice-transcription-design.md`

**Interfaces:**
- Consumes: Current production source and the approved design.
- Produces: A local Git working copy imported into Coze Code, with a passing baseline test run.

- [ ] **Step 1: Copy production source without runtime data or secrets**

Run from `/Users/a0000/Documents/装修行业FDE`:

```bash
rsync -az --exclude node_modules --exclude .env \
  <ssh-user>@<production-ssh-host>:/opt/wecom-chat-pipeline/ ./wecom-chat-pipeline/
```

- [ ] **Step 2: Initialize version control and install the locked dependencies**

```bash
cd /Users/a0000/Documents/装修行业FDE/wecom-chat-pipeline
git init
git add .
git commit -m "chore: import production WeCom pipeline"
npm ci
```

- [ ] **Step 3: Verify the unmodified baseline**

Run: `npm test`

Expected: six tests pass and zero tests fail.

- [ ] **Step 4: Import the working copy into Coze Code and send the approved design**

Use `coze code project import -s local` after reading its command reference. Send a development message that references the approved design file and requires TDD, preservation of existing behavior, and no deployment from Coze Code. Record the returned `project_id` for recoverable status checks.

- [ ] **Step 5: Commit the local baseline metadata**

```bash
git add package-lock.json
git commit -m "chore: establish reproducible baseline"
```

### Task 2: Preserve Voice Metadata During Archive Normalization

**Files:**
- Modify: `scripts/wecom-archive-adapter.mjs`
- Modify: `test/archive-adapter.test.js`

**Interfaces:**
- Consumes: Decrypted WeCom messages whose voice payload is `message.voice`.
- Produces: `normalizeMessage(seq, message)` values containing `sdk_file_id`, `voice_size`, and `play_length` for voice messages while preserving the existing text shape.

- [ ] **Step 1: Write the failing voice-normalization test**

Add a test with this input:

```js
const normalized = normalizeMessage(253, {
  msgid: 'voice-253',
  roomid: 'wr-room',
  from: 'worker-1',
  msgtime: 1785620000000,
  msgtype: 'voice',
  voice: { sdkfileid: 'sdk-file-secret', voice_size: 4218, play_length: 8 }
})

assert.equal(normalized.content, '[voice]')
assert.equal(normalized.sdk_file_id, 'sdk-file-secret')
assert.equal(normalized.voice_size, 4218)
assert.equal(normalized.play_length, 8)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test test/archive-adapter.test.js`

Expected: FAIL because `sdk_file_id`, `voice_size`, and `play_length` are absent.

- [ ] **Step 3: Implement minimal metadata normalization**

Add only voice fields to the normalized object:

```js
const voice = message.msgtype === 'voice' ? message.voice || {} : {}
return {
  ...(message.msgtype === 'voice' ? {
    sdk_file_id: voice.sdkfileid || '',
    voice_size: Number(voice.voice_size || 0),
    play_length: Number(voice.play_length || 0)
  } : {})
}
```

- [ ] **Step 4: Run focused and full tests**

Run: `node --test test/archive-adapter.test.js && npm test`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/wecom-archive-adapter.mjs test/archive-adapter.test.js
git commit -m "feat: preserve WeCom voice media metadata"
```

### Task 3: Add Chunked Finance SDK Media Download

**Files:**
- Modify: `native/wecom-finance-cli.cpp`
- Create: `native/media-download-loop.h`
- Create: `native/media-download-loop-test.cpp`

**Interfaces:**
- Consumes: `media SDK_FILE_ID OUTPUT_FILE` and initialized Finance SDK credentials from the environment.
- Produces: A complete output file written through `OUTPUT_FILE.part`, renamed only after `IsMediaDataFinish()` is true.

- [ ] **Step 1: Extract a testable chunk loop contract and write a failing C++ test**

Define:

```cpp
using FetchChunk = std::function<MediaChunk(const std::string& index)>;
void download_media_chunks(const std::string& output_path, FetchChunk fetch);
```

The test supplies two chunks (`abc`, `def`), asserts the final file is `abcdef`, and asserts the requested indexes are `""` then `"next-1"`. A second test makes the fetcher throw on the second chunk and asserts neither the final file nor `.part` remains.

- [ ] **Step 2: Compile and verify RED**

```bash
g++ -std=c++17 -Wall -Wextra -Werror native/media-download-loop-test.cpp -o /tmp/media-download-loop-test
/tmp/media-download-loop-test
```

Expected: compilation fails because the download-loop interface does not exist.

- [ ] **Step 3: Implement the minimal chunk loop**

Write every chunk in binary mode, flush/close on completion, and use `std::filesystem::rename()` only after the terminal chunk. On exception, close and remove `.part` before rethrowing.

- [ ] **Step 4: Wire the real SDK command**

Extend usage to:

```text
wecom-finance-cli fetch SEQ LIMIT | decrypt DECRYPTED_KEY ENCRYPTED_MESSAGE | media SDK_FILE_ID OUTPUT_FILE
```

For each fetch callback, allocate `MediaData_t`, call `GetMediaData`, copy `data_len` bytes and `out_len` bytes before freeing the SDK object, and map nonzero SDK results to a nonzero process exit.

- [ ] **Step 5: Compile and run tests**

```bash
g++ -std=c++17 -Wall -Wextra -Werror native/media-download-loop-test.cpp -o /tmp/media-download-loop-test
/tmp/media-download-loop-test
g++ -std=c++17 -O2 -I/opt/wecom-sdk/src/C_sdk \
  native/wecom-finance-cli.cpp -L/opt/wecom-sdk/src/C_sdk \
  -Wl,-rpath,/opt/wecom-sdk/src/C_sdk -lWeWorkFinanceSdk_C \
  -o /tmp/wecom-finance-cli.new
```

Expected: tests pass and the production binary links successfully.

- [ ] **Step 6: Commit**

```bash
git add native/wecom-finance-cli.cpp native/media-download-loop.h native/media-download-loop-test.cpp
git commit -m "feat: download WeCom archived media"
```

### Task 4: Add Idempotent Media Persistence

**Files:**
- Modify: `src/database-postgres.js`
- Create: `test/database-postgres-media.test.js`

**Interfaces:**
- Produces:
  - `upsertVoiceMedia(db, messages): Promise<number>`
  - `refreshVoiceRawMetadata(db, messages): Promise<number>`
  - `claimMediaTasks(db, limit): Promise<MediaTask[]>`
  - `markMediaDownloaded(db, mediaId, metadata): Promise<void>`
  - `markMediaRetryable(db, mediaId, error): Promise<void>`
  - `completeMediaTranscript(db, mediaId, msgId, transcript): Promise<void>`

- [ ] **Step 1: Write PostgreSQL repository contract tests**

Using a recording database double that implements `query`, `connect`, transaction calls, and row results, assert that two upserts for the same `msg_id + voice` use the unique conflict target; `completeMediaTranscript` sets `media.status='done'`, saves plain transcript text, and sets `messages.content='【语音转写】测试文字'` in one transaction. Assert `refreshVoiceRawMetadata` merges the newly recovered voice metadata into `messages.raw_json` without replacing an existing transcript in `messages.content`.

- [ ] **Step 2: Run and verify RED**

Run: `node --test test/database-postgres-media.test.js`

Expected: FAIL because the media repository functions and columns do not exist.

- [ ] **Step 3: Add compatible migration columns**

Add `ALTER TABLE media ADD COLUMN IF NOT EXISTS` statements for:

```text
sdk_file_id TEXT NOT NULL DEFAULT ''
file_format TEXT NOT NULL DEFAULT ''
provider TEXT NOT NULL DEFAULT ''
attempts INTEGER NOT NULL DEFAULT 0
last_error TEXT NOT NULL DEFAULT ''
next_attempt_at TIMESTAMPTZ
transcribed_at TIMESTAMPTZ
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

Add an index on `(status, next_attempt_at, media_id)`.

- [ ] **Step 4: Implement repository methods**

Use `INSERT ... ON CONFLICT(msg_id, media_type) DO UPDATE` to backfill a missing `sdk_file_id`. Merge recovered normalized voice JSON into `messages.raw_json` while leaving `messages.content` unchanged. Claim tasks with `FOR UPDATE SKIP LOCKED`, an attempts cap of 5, and a caller-provided batch size. Complete transcript and message update inside one transaction.

- [ ] **Step 5: Run focused and full tests**

Run: `node --test test/database-postgres-media.test.js && npm test`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/database-postgres.js test/database-postgres-media.test.js
git commit -m "feat: persist voice transcription jobs"
```

### Task 5: Implement the Alibaba Cloud ISI Client

**Files:**
- Modify: `src/config.js`
- Create: `src/aliyun-isi-client.js`
- Create: `test/aliyun-isi-client.test.js`
- Modify: `.env.example`

**Interfaces:**
- Produces: `new AliyunIsiClient(options).transcribe({ audio, format, sampleRate }): Promise<{ text, taskId }>`.
- Uses: `@alicloud/pop-core` `CreateToken`, then `POST https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr`.

- [ ] **Step 1: Write failing client tests**

Inject `createToken` and `fetchImpl`. Assert that two transcriptions reuse a token whose `ExpireTime` is more than 300 seconds away, and that the ASR request contains:

```text
appkey=app-key-test
format=amr
sample_rate=8000
enable_punctuation_prediction=true
enable_inverse_text_normalization=true
```

Assert a `20000000` response returns `result`, while quota/auth responses throw typed errors with `retryable=false`.

- [ ] **Step 2: Run and verify RED**

Run: `node --test test/aliyun-isi-client.test.js`

Expected: FAIL because `AliyunIsiClient` does not exist.

- [ ] **Step 3: Add minimal configuration without a new dependency**

Add config keys:

```js
voiceTranscriptionEnabled: booleanEnv('VOICE_TRANSCRIPTION_ENABLED', false),
aliyunAccessKeyId: env('ALIYUN_ACCESS_KEY_ID', ''),
aliyunAccessKeySecret: env('ALIYUN_ACCESS_KEY_SECRET', ''),
aliyunNlsAppKey: env('ALIYUN_NLS_APP_KEY', ''),
aliyunNlsRegion: env('ALIYUN_NLS_REGION', 'cn-shanghai'),
mediaDirectory: resolve(rootDir, env('WECOM_MEDIA_DIRECTORY', 'data/media')),
mediaBatchSize: 1
```

- [ ] **Step 4: Implement token caching and ASR request**

Use built-in `crypto.createHmac('sha1', accessKeySecret + '&')` to sign the POP `CreateToken` request to `https://nls-meta.cn-shanghai.aliyuncs.com`, API version `2019-02-28`. Percent-encode and sort parameters according to the POP signature contract. Refresh when less than 300 seconds remain. Send raw audio bytes as the POST body with `X-NLS-Token`; parse JSON without logging the body.

- [ ] **Step 5: Run focused and full tests**

Run: `node --test test/aliyun-isi-client.test.js && npm test`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/config.js src/aliyun-isi-client.js test/aliyun-isi-client.test.js .env.example
git commit -m "feat: add Alibaba Cloud ISI client"
```

### Task 6: Orchestrate Download, Transcription, and Backfill

**Files:**
- Modify: `src/archive-provider.js`
- Modify: `scripts/wecom-archive-adapter.mjs`
- Create: `src/media-processor.js`
- Modify: `src/pipeline.js`
- Modify: `src/cli.js`
- Create: `test/media-processor.test.js`
- Modify: `test/pipeline.test.js`

**Interfaces:**
- Produces:
  - `CommandArchiveProvider.downloadMedia(sdkFileId, outputFile): Promise<void>`
  - `processPendingVoiceMedia(db, config, store, provider, client): Promise<MediaSummary>`
  - CLI command `backfill-voice --after-seq SEQ`

- [ ] **Step 1: Write failing processor tests**

Use fake provider/client objects and a fake store to assert:

1. A pending voice task downloads to a deterministic path, hashes the file, transcribes it, and calls `completeMediaTranscript`.
2. A temporary download/ASR error calls `markMediaRetryable` and continues with the next task.
3. Disabled or incomplete ASR configuration returns `{ skipped: true }` without downloading.
4. Two collected copies of the same voice message create only one media task.

- [ ] **Step 2: Run and verify RED**

Run: `node --test test/media-processor.test.js test/pipeline.test.js`

Expected: FAIL because media orchestration is absent.

- [ ] **Step 3: Implement download and processing boundaries**

`CommandArchiveProvider.downloadMedia` executes the existing archive adapter:

```js
await execFileAsync(this.command, ['media', '--sdk-file-id', sdkFileId, '--output', outputFile], {
  env: process.env,
  maxBuffer: 1024 * 1024
})
```

Extend the adapter's `main()` so this action calls the configured native CLI as `media SDK_FILE_ID OUTPUT_FILE`. The processor creates the media directory with mode `0700`, processes exactly one task at a time, detects AMR (`#!AMR`) or other supported encodings from file signatures, and does not include transcript text in logs. After `completeMediaTranscript` commits the transcript and SHA-256, remove the local audio and clear `media.local_path`; if either remote call or database commit fails, retain the file for the bounded retry. Unsupported encodings are marked `retryable` with a sanitized reason.

- [ ] **Step 4: Integrate collection**

After `insertMessages`, call `upsertVoiceMedia` even for messages whose `messages` row already existed; this enables historical metadata backfill. Run `processPendingVoiceMedia` after collection, outside the archive cursor transaction, so ASR failure cannot prevent the cursor from advancing.

- [ ] **Step 5: Add explicit backfill command**

`backfill-voice --after-seq 0` fetches archive batches independently of `archive_seq`, filters voice messages, upserts their normalized raw JSON and media tasks, then processes the pending batch. It must not reduce or overwrite the live `archive_seq`.

- [ ] **Step 6: Run focused and full tests**

Run: `node --test test/media-processor.test.js test/pipeline.test.js && npm test`

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/archive-provider.js src/media-processor.js src/pipeline.js src/cli.js test/media-processor.test.js test/pipeline.test.js
git commit -m "feat: transcribe collected WeCom voice messages"
```

### Task 7: Deploy Safely to Alibaba Cloud ECS

**Files:**
- Modify on server: `/opt/wecom-chat-pipeline/**`
- Modify on server: `/opt/wecom-sdk/bin/wecom-finance-cli`
- Modify on server: `/etc/wecom-chat-pipeline/secrets.env`
- Create on server: `/opt/wecom-chat-pipeline/data/media/`

**Interfaces:**
- Consumes: Fully tested local commits and Alibaba Cloud ISI credentials/AppKey.
- Produces: A running `wecom-chat-pipeline.service` with voice transcription enabled.

- [ ] **Step 1: Verify Coze Code completion and inspect its changes**

Query the recorded project with `coze code message status -p "$COZE_PROJECT_ID" --format json`. Require status `done`; review the patch against this plan and run the complete local test suite before deployment.

- [ ] **Step 2: Create timestamped recoverable backups**

On the server:

```bash
install -d -m 700 /root/wecom-backups
pg_dump -Fc -d wecom_chat -f /root/wecom-backups/wecom_chat-20260803.dump
tar -C /opt -czf /root/wecom-backups/wecom-chat-pipeline-20260803.tgz wecom-chat-pipeline
cp -a /opt/wecom-sdk/bin/wecom-finance-cli /root/wecom-backups/wecom-finance-cli-20260803
```

Verify each backup exists and is nonempty before continuing.

- [ ] **Step 3: Stage release without overwriting secrets or runtime media**

Use `rsync --delete` with explicit exclusions for `.env`, `data/`, and `node_modules/`, then run `npm ci --omit=dev` in `/opt/wecom-chat-pipeline`. Install the new native binary first as `/opt/wecom-sdk/bin/wecom-finance-cli.new`, run `ldd` and `--help`/usage checks, then atomically rename it over the old binary.

- [ ] **Step 4: Apply configuration securely**

Append only missing keys to `/etc/wecom-chat-pipeline/secrets.env`, set `VOICE_TRANSCRIPTION_ENABLED=true`, create `/opt/wecom-chat-pipeline/data/media` with mode `0700`, then confirm the secret file remains `root:root 0600`. Never print values during verification.

- [ ] **Step 5: Run migration and regression tests before restart**

```bash
cd /opt/wecom-chat-pipeline
npm test
set -a
. /etc/wecom-chat-pipeline/secrets.env
set +a
node src/cli.js init
```

Expected: all tests pass and migrations finish without destructive SQL.

- [ ] **Step 6: Backfill one historical voice first**

Run the backfill with a batch size of one, verify exactly one `media` row reaches `done`, and check that the corresponding `messages.content` starts with `【语音转写】` without printing the remainder.

- [ ] **Step 7: Restart and verify production**

```bash
systemctl restart wecom-chat-pipeline.service
systemctl --no-pager --full status wecom-chat-pipeline.service
journalctl -u wecom-chat-pipeline.service --since '-5 minutes' --no-pager
```

Verify the service is `active (running)`, no credential/transcript appears in logs, and text collection continues.

- [ ] **Step 8: Backfill remaining historical voices and report counts**

Run the bounded backfill for the remaining archived voice messages. Report only status counts (`done`, `retryable`, `failed`) and the number of message rows updated, not transcript bodies.

- [ ] **Step 9: Roll back if acceptance fails**

Stop the service, restore the application tarball and old native binary, run `npm ci --omit=dev`, and restart. Leave additive database columns in place; restore the PostgreSQL dump only if data integrity—not application behavior—was damaged.

- [ ] **Step 10: Commit deployment notes**

```bash
git add README.md .env.example
git commit -m "docs: document voice transcription operations"
```

## Plan Self-Review

- Every approved design requirement maps to Tasks 2–7.
- New behavior is introduced only after a focused failing test.
- All production mutations occur after three verified backups.
- The live archive cursor is isolated from historical backfill.
- Credentials are required only at deployment acceptance, not for unit tests.
- No step prints secrets, media identifiers, audio bytes, or transcripts.

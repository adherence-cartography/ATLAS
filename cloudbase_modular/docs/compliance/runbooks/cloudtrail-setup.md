---
document: Runbook — AWS CloudTrail Setup
classification: Internal — Operations
version: 1.0
date: 2026-06-08
---

# Runbook: AWS CloudTrail Setup

**Purpose:** Enable AWS CloudTrail to capture all API calls across the ATLAS AWS account. This provides infrastructure-level audit coverage satisfying 21 CFR Part 11 §11.10(d) and the HIPAA Security Rule audit control requirement (45 CFR §164.312(b)).

**Estimated time:** 20–30 minutes  
**AWS access required:** CloudTrail full access, S3 full access, (optional) SNS access  
**Risk:** Low — CloudTrail is read-only monitoring; enabling it does not change application behavior

---

## Prerequisites

- [ ] You are signed in to the AWS Console as an admin-level user
- [ ] You are in the correct AWS region (us-east-1 for primary ATLAS infrastructure)
- [ ] You have decided on a log retention period (recommended: 90 days active, then Glacier; see audit-retention-policy.md)

---

## Step 1: Create the S3 Bucket for CloudTrail Logs

CloudTrail requires a dedicated S3 bucket with a specific bucket policy.

1. Navigate to **S3** → **Create bucket**
2. **Bucket name:** `atlas-cloudtrail-logs` (must be globally unique — append your account ID if needed, e.g., `atlas-cloudtrail-logs-123456789012`)
3. **Region:** `us-east-1` (same as primary ATLAS region)
4. **Object Ownership:** Leave as ACLs disabled (recommended)
5. **Block Public Access:** Keep all four checkboxes checked (block all public access)
6. **Versioning:** Enable (important — prevents accidental overwrites of log files)
7. **Default encryption:** Enable with SSE-S3 or SSE-KMS
8. Click **Create bucket**

### Apply the Required Bucket Policy

CloudTrail needs permission to write to your bucket:

1. Click your new bucket → **Permissions** tab → **Bucket policy** → **Edit**
2. Paste the following policy, replacing `YOUR_BUCKET_NAME` and `YOUR_ACCOUNT_ID`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AWSCloudTrailAclCheck",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudtrail.amazonaws.com"
      },
      "Action": "s3:GetBucketAcl",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME"
    },
    {
      "Sid": "AWSCloudTrailWrite",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudtrail.amazonaws.com"
      },
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/AWSLogs/YOUR_ACCOUNT_ID/*",
      "Condition": {
        "StringEquals": {
          "s3:x-amz-acl": "bucket-owner-full-control"
        }
      }
    }
  ]
}
```

3. Click **Save changes**

---

## Step 2: Configure S3 Lifecycle Rules

Set up automatic log management to control storage costs while meeting retention requirements:

1. In your S3 bucket, click **Management** → **Lifecycle rules** → **Create lifecycle rule**
2. **Rule name:** `cloudtrail-log-lifecycle`
3. **Rule scope:** Apply to all objects in the bucket
4. Add the following transitions and expiration:

| Action | Days after creation |
|--------|-------------------|
| Transition to S3 Standard-IA | 30 days |
| Transition to S3 Glacier Instant Retrieval | 60 days |
| Expire (permanently delete) | 90 days |

5. Click **Create rule**

> If CloudTrail logs may be needed for a legal hold or regulatory inquiry beyond 90 days, export them to a separate archival bucket before the expiry date. See the Legal Hold Procedure in audit-retention-policy.md.

---

## Step 3: Create the CloudTrail Trail

1. Navigate to **CloudTrail** → **Trails** → **Create trail**

2. **Trail name:** `atlas-cloudtrail`

3. **Storage location:**
   - Select **Use existing S3 bucket**
   - Enter your bucket name: `atlas-cloudtrail-logs`
   - Leave the log file prefix empty or set to `cloudtrail/`

4. **Log file SSE-KMS encryption:** Enable (recommended) or leave as SSE-S3

5. **Log file validation:** **Enable** — this is critical. CloudTrail will generate a digest file every hour that can be used to verify that log files have not been tampered with. This satisfies the integrity requirement of 21 CFR Part 11 §11.10(d).

6. **SNS notification (optional):** See Step 5 for setup. Leave disabled for now if skipping.

7. Click **Next**

8. **Event type:** Select **Management events** (required) and optionally **Data events**
   - Under Management events: select **Read** and **Write** (capture all API calls)
   - Under Data events: optionally add DynamoDB table-level logging for `atlas-audit-log` and `atlas_assessments` — this logs individual item-level reads/writes (higher cost but maximum auditability)

9. Click **Next** → Review → **Create trail**

---

## Step 4: Enable Log File Validation

Log file validation should have been enabled in Step 3. Verify:

1. Navigate to **CloudTrail** → **Trails** → click **atlas-cloudtrail**
2. Under **General details**, confirm **Log file validation** shows **Enabled**

To verify integrity of existing logs using the AWS CLI:

```bash
aws cloudtrail validate-logs \
  --trail-arn arn:aws:cloudtrail:us-east-1:YOUR_ACCOUNT_ID:trail/atlas-cloudtrail \
  --start-time 2026-06-01T00:00:00Z \
  --region us-east-1
```

**Expected output:**
```
Validating log files for trail arn:aws:cloudtrail:us-east-1:...:trail/atlas-cloudtrail
...
Results requested for 2026-06-01T00:00:00Z to [now]
Results found for [DATE] to [DATE]:
  X log files validated, 0 log files invalid.
```

---

## Step 5: (Optional) SNS Notification Setup

Configure CloudTrail to send an SNS notification every time a new log file is delivered to S3. Useful for real-time alerting on unusual API activity.

1. Navigate to **SNS** → **Topics** → **Create topic**
2. **Type:** Standard
3. **Name:** `atlas-cloudtrail-notifications`
4. Click **Create topic**
5. Click **Create subscription** → Protocol: **Email** → Endpoint: `compliance@adherence.cc`
6. Confirm the subscription from the email that arrives

Then link to CloudTrail:

1. Go back to **CloudTrail** → **Trails** → **atlas-cloudtrail** → **Edit**
2. Under **SNS notification**, select **Enabled**
3. Choose the topic `atlas-cloudtrail-notifications`
4. Save

---

## Step 6: Verify the Trail is Capturing Events

### Method 1: Check S3 bucket for log files

After 5–15 minutes, log files should appear in your S3 bucket:

1. Navigate to **S3** → **atlas-cloudtrail-logs**
2. Browse to `AWSLogs/YOUR_ACCOUNT_ID/CloudTrail/us-east-1/YYYY/MM/DD/`
3. You should see `.json.gz` log files. Download and decompress one to verify content.

### Method 2: Use CloudTrail Event History

1. Navigate to **CloudTrail** → **Event history**
2. You should see recent API calls listed (Console sign-in events, EC2/Lambda/DynamoDB calls, etc.)
3. Filter by **Event source: dynamodb.amazonaws.com** to see DynamoDB activity
4. Filter by **Event source: lambda.amazonaws.com** to see Lambda invocations

### Method 3: AWS CLI verification

```bash
aws cloudtrail get-trail-status \
  --name atlas-cloudtrail \
  --region us-east-1
```

**Expected output confirms:**
- `"IsLogging": true`
- `"LatestDeliveryTime"` shows a recent timestamp (within the last 15 minutes)
- `"LatestCloudWatchLogsDeliveryTime"` if CloudWatch integration is configured

---

## Step 7: (Optional) CloudWatch Logs Integration

Send CloudTrail logs to CloudWatch Logs for real-time querying and alerting:

1. In **CloudTrail** → **atlas-cloudtrail** → **Edit**
2. Under **CloudWatch Logs**, click **Enabled**
3. **Log group:** `/atlas/cloudtrail`
4. **IAM role:** Allow CloudTrail to create a new role for CloudWatch delivery
5. Save

Once integrated, you can create CloudWatch Metric Filters to alert on:
- Root account usage: filter for `$.userIdentity.type = "Root"`
- DynamoDB DeleteTable calls: filter for `$.eventName = "DeleteTable"`
- IAM policy changes: filter for `$.eventSource = "iam.amazonaws.com"`

---

## Screenshot Checklist

- [ ] CloudTrail trail **atlas-cloudtrail** created and shows **Logging: ON**
- [ ] Log file validation shows **Enabled**
- [ ] S3 bucket **atlas-cloudtrail-logs** exists with versioning enabled
- [ ] S3 bucket policy applied (CloudTrail write permission)
- [ ] S3 lifecycle rule configured (30d → Standard-IA, 60d → Glacier, 90d → delete)
- [ ] At least one log file visible in S3 bucket (confirms trail is active)
- [ ] CloudTrail Event History shows recent API activity
- [ ] (Optional) SNS subscription confirmed at compliance@adherence.cc

Store these screenshots in the ATLAS compliance folder as evidence for the CFR-11 and HIPAA audit trail validation package.

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| No log files appearing in S3 after 15 minutes | Bucket policy incorrect | Re-apply bucket policy from Step 1; ensure account ID is correct |
| Trail creation fails with "insufficient permissions" | Missing S3:PutObject permission | Verify bucket policy includes the CloudTrail service principal |
| Log file validation fails | Log files may have been modified or deleted | Investigate access to S3 bucket; enable S3 access logging |
| Event history shows no DynamoDB events | DynamoDB data events not enabled | Edit trail → Data events → add DynamoDB table ARNs |

---

**Runbook owner:** Technical Lead / Platform Owner  
**Last tested:** 2026-06-08  
**Next review:** 2027-06-08

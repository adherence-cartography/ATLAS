---
document: Runbook — DynamoDB Audit Table IAM Deny Policy
classification: Internal — Operations
version: 1.0
date: 2026-06-08
---

# Runbook: DynamoDB Audit Table IAM Deny Policy

**Purpose:** Apply an IAM Deny policy to the `atlas-audit-log` DynamoDB table that blocks `DeleteItem` and `UpdateItem` for all roles — including the Lambda execution role — making the audit trail immutable. This satisfies 21 CFR Part 11 §11.10(d)(e) and the ATLAS audit retention policy (Tier 1).

**Estimated time:** 10–15 minutes  
**AWS access required:** IAM full access (or AdministratorAccess)  
**Risk:** Low — this adds a Deny rule only; it does not remove any existing permissions

---

## Prerequisites

- [ ] You are signed in to the AWS Console with an account that has IAM write permissions
- [ ] You know the exact ARN of the Lambda execution role used by the ATLAS Lambda function
- [ ] The DynamoDB table `atlas-audit-log` already exists (verify in DynamoDB console)

---

## Step 1: Locate the Lambda Execution Role ARN

1. Open the **AWS Console**: https://console.aws.amazon.com
2. Navigate to **Lambda** → **Functions**
3. Click your ATLAS Lambda function (e.g., `atlas-backend` or `atlas-db-handler`)
4. Click the **Configuration** tab → **Permissions**
5. Under "Execution role", click the role name link — this opens IAM
6. Copy the **Role ARN** shown at the top. It will look like:
   ```
   arn:aws:iam::123456789012:role/atlas-lambda-execution-role
   ```
   Keep this ARN — you will need it in Step 3.

---

## Step 2: Locate the DynamoDB Table ARN

1. Navigate to **DynamoDB** → **Tables**
2. Click **atlas-audit-log** (or your exact table name)
3. Click the **Additional info** tab (or **Overview** → scroll down)
4. Copy the **Amazon Resource Name (ARN)**. It will look like:
   ```
   arn:aws:dynamodb:us-east-1:123456789012:table/atlas-audit-log
   ```

---

## Step 3: Edit the Lambda Execution Role IAM Policy

1. Navigate to **IAM** → **Roles**
2. Search for and click your Lambda execution role (from Step 1)
3. Click the **Permissions** tab
4. Click **Add permissions** → **Create inline policy**
5. Click the **JSON** tab (switch from the visual editor)
6. Paste the following policy exactly, replacing `YOUR_ACCOUNT_ID` and `us-east-1` with your values:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyAuditLogMutation",
      "Effect": "Deny",
      "Action": [
        "dynamodb:DeleteItem",
        "dynamodb:UpdateItem"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:YOUR_ACCOUNT_ID:table/atlas-audit-log"
    }
  ]
}
```

7. Click **Next**
8. Name the policy: `atlas-audit-log-immutability-deny`
9. Click **Create policy**

---

## Step 4: (Optional but Recommended) Apply Resource-Based Policy on the Table

For defense-in-depth, also apply the Deny directly as a DynamoDB resource-based policy so it applies regardless of which IAM principal calls the API.

1. Navigate to **DynamoDB** → **Tables** → **atlas-audit-log**
2. Click the **Additional settings** tab → **Resource-based policy**
3. Click **Edit**
4. Paste the following:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyAllMutations",
      "Effect": "Deny",
      "Principal": "*",
      "Action": [
        "dynamodb:DeleteItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteTable"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:YOUR_ACCOUNT_ID:table/atlas-audit-log"
    }
  ]
}
```

5. Click **Save**

> **Note:** This resource-based policy blocks DeleteTable to protect against accidental table deletion. The `PutItem` action is left permitted so that new audit entries can still be written.

---

## Step 5: Enable DynamoDB Point-in-Time Recovery (PITR)

While in the DynamoDB table, enable continuous backups:

1. Navigate to **DynamoDB** → **Tables** → **atlas-audit-log**
2. Click the **Backups** tab
3. Under **Point-in-time recovery (PITR)**, click **Enable**
4. Confirm when prompted

PITR enables restoration to any second within the last 35 days. This satisfies the CFR-11 audit trail disaster recovery requirement.

---

## Step 6: Verification

### Test that DeleteItem is blocked

Run this AWS CLI command from your terminal (requires AWS CLI configured with the Lambda role's credentials, or use the AWS CloudShell):

```bash
aws dynamodb delete-item \
  --table-name atlas-audit-log \
  --key '{"pk": {"S": "TEST_KEY_THAT_DOES_NOT_EXIST"}}' \
  --region us-east-1
```

**Expected result:**
```
An error occurred (AccessDeniedException) when calling the DeleteItem operation:
User: arn:aws:sts::...assumed-role/atlas-lambda-execution-role/... is not authorized
to perform: dynamodb:DeleteItem on resource: arn:aws:dynamodb:us-east-1:...:table/atlas-audit-log
with an explicit deny in an identity-based policy
```

If you see `AccessDeniedException` — the Deny is working correctly.

### Test that PutItem still works

```bash
aws dynamodb put-item \
  --table-name atlas-audit-log \
  --item '{"pk": {"S": "IAM_VERIFY_TEST"}, "ts": {"N": "1234567890"}, "test": {"BOOL": true}}' \
  --region us-east-1
```

**Expected result:** No error. The item is written. Then manually delete this test item via the AWS Console (DynamoDB → Explore items → delete) before the Deny policy is fully applied to the console role, or clean up via a temporary admin override.

---

## Screenshot Checklist

Before closing, confirm you can screenshot or record the following states:

- [ ] IAM role → Permissions tab shows `atlas-audit-log-immutability-deny` inline policy
- [ ] DynamoDB table → Additional settings → Resource-based policy shows the Deny statement
- [ ] DynamoDB table → Backups tab shows PITR status: **Enabled**
- [ ] AWS CLI test output showing `AccessDeniedException` for `DeleteItem`

Store these screenshots in the ATLAS compliance folder as evidence for the CFR-11 validation package.

---

## Rollback (Emergency Only)

If the Deny policy causes an unexpected operational issue:

1. Go to **IAM** → **Roles** → your Lambda role → **Permissions**
2. Find the `atlas-audit-log-immutability-deny` inline policy
3. Click **Delete** and confirm

Any rollback of this policy must be documented with justification in the ATLAS change control log and reported to the Privacy Officer within 24 hours.

---

**Runbook owner:** Technical Lead / Platform Owner  
**Last tested:** 2026-06-08  
**Next review:** 2027-06-08

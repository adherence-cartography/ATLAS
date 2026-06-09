# Firebase Security Rules — infrastructure_poi

**Node:** `/infrastructure_poi`

Paste the rules block below into the Firebase Console under
**Realtime Database > Rules** and merge them into the existing rules JSON.

---

## Rule intent

| Operation | Who | Condition |
|-----------|-----|-----------|
| Read any record | Anyone (public) | Always |
| Create a new record (push) | Authenticated users (including anonymous) | New data must include required fields; `contributor_id` must equal caller UID |
| Update `confirmations` / `confirmed_by` / `verified` | Authenticated non-owner | Caller UID not in existing `confirmed_by`; may only increment, not decrement |
| Delete | Nobody | Prohibited unconditionally |

---

## Rules JSON

```json
{
  "rules": {
    "infrastructure_poi": {
      ".read": true,

      "$poi_id": {
        ".read": true,

        ".write": "auth !== null && (
          !data.exists() || (
            newData.exists() &&
            newData.child('confirmations').val() === data.child('confirmations').val() + 1 &&
            newData.child('confirmations').val() >= 1 &&
            newData.child('contributor_id').val() === data.child('contributor_id').val() &&
            newData.child('type').val()           === data.child('type').val() &&
            newData.child('name').val()           === data.child('name').val() &&
            newData.child('latitude').val()       === data.child('latitude').val() &&
            newData.child('longitude').val()      === data.child('longitude').val()
          )
        )",

        ".validate": "newData.hasChildren(['type','name','latitude','longitude','contributor_id','contributed_at','confirmations','confirmed_by','verified'])",

        "type":           { ".validate": "newData.isString() && newData.val().matches(/^(pharmacy|hospital|clinic|transport|food_bank|community_center)$/)" },
        "name":           { ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 120" },
        "latitude":       { ".validate": "newData.isNumber() && newData.val() >= -90  && newData.val() <= 90"  },
        "longitude":      { ".validate": "newData.isNumber() && newData.val() >= -180 && newData.val() <= 180" },
        "country":        { ".validate": "newData.isString()" },
        "city":           { ".validate": "newData.isString()" },
        "address":        { ".validate": "newData.isString()" },
        "contributor_id": {
          ".validate": "newData.isString() && (
            !data.exists()
              ? newData.val() === auth.uid
              : newData.val() === data.val()
          )"
        },
        "contributed_at": { ".validate": "newData.isNumber()" },
        "confirmations":  { ".validate": "newData.isNumber() && newData.val() >= 1" },
        "confirmed_by":   { ".validate": "newData.isString()" },
        "verified":       { ".validate": "newData.isBoolean()" },
        "notes":          { ".validate": "newData.isString() && newData.val().length <= 400" },

        "$other":         { ".validate": false }
      }
    }
  }
}
```

> **Note on `confirmed_by`:** Firebase Realtime Database does not support
> array types natively. When the client SDK writes a JavaScript array it is
> stored as an object with integer keys (`{"0":"uid1","1":"uid2"}`). The rule
> above validates the field exists as a string-serialisable node. The
> transaction logic in `_poiContribVerify()` handles de-duplication on the
> client before writing. For stricter server-side enforcement, migrate to
> Firestore where array-contains queries are natively supported.

---

## Full platform rules context

These rules must be merged with the existing platform rules, not replace them.
The existing rules govern paths such as `/assessments`, `/peacs_assessments`,
`/audit_log`, `/public_stats`, etc.  A safe merge looks like:

```json
{
  "rules": {
    "assessments":  { "...": "existing rules" },
    "public_stats": { "...": "existing rules" },

    "infrastructure_poi": {
      "...": "paste the infrastructure_poi block from above"
    }
  }
}
```

---

## Integration note

`poi-contributor.js` must be loaded on any page that uses the globe before
`</body>`:

```html
<script src="modules/poi-contributor.js"></script>
```

Dependencies required on the page before `poi-contributor.js`:

| Global | Source |
|--------|--------|
| `firebase` | Firebase compat SDK (`firebase-app-compat.js`) |
| `database` | `firebase.database()` initialised in `modules/firebase-init.js` |
| `window.userLocation` | Set by geolocation module (optional; if absent the user must supply coordinates) |
| `showToast(msg)` | `modules/forms-helpers.js` or `assess.html` inline (optional; falls back to `alert()`) |

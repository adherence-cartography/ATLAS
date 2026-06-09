# POI Contributor Module — Integration Note

## Script tag to add to assess.html (and any other page using the globe)

Add the following script tag to `assess.html` (and any other page that loads
the Mapbox globe via `sa-globe.js`) immediately before `</body>`:

```html
<script src="modules/poi-contributor.js"></script>
```

Place it after the existing module script tags so that Firebase and the
database global are already initialised when this file executes.

---

## Dependencies

`poi-contributor.js` requires the following globals to be available when its
functions are called at runtime (not necessarily at parse time):

| Global | Where it comes from | Required |
|--------|---------------------|----------|
| `firebase` | `firebase-app-compat.js` + `firebase-auth-compat.js` loaded in `<head>` | Yes |
| `database` | `window.database = firebase.database()` set in `modules/firebase-init.js` | Yes |
| `window.userLocation` | Set by the geolocation module when the user allows location access | No (falls back gracefully) |
| `showToast(msg)` | Defined in `modules/forms-helpers.js` and inline in `assess.html` | No (falls back to `alert()`) |

---

## Functions exposed globally

After loading, the following functions are available on the page's global scope:

| Function | Description |
|----------|-------------|
| `_poiContribOpen(lat?, lon?)` | Opens the POI contribution modal. If lat/lon are omitted, uses `window.userLocation`. |
| `_poiContribSubmit(coords)` | Called internally by the modal submit button. Writes to Firebase. |
| `_poiContribVerify(poiKey, record)` | Called from a POI detail view to confirm an existing POI. |

The globe module (`sa-globe.js`) calls `_poiContribOpen()` from the "Add POI"
button that appears in the layer controls panel when the Verified POIs toggle
is active.

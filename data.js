/* =========================================================================
   CliniScope — Shared Data Layer
   Used by map.html and facility.html (and, later, admin.html).

   Facility data now lives in Supabase (PostgreSQL). Every page goes through
   the same three functions below — getFacilities(), getFacilityById(),
   saveFacility() — so if the connection details or table structure ever
   change, this is the ONLY file that needs to change.

   IMPORTANT: these functions are now ASYNC (they return Promises), because
   fetching from Supabase happens over the network and takes a moment.
   Any page using them must `await` the result — see map.html / facility.html
   for the pattern (facilitiesPromise / facilityPromise).

   Requires the Supabase JS SDK to be loaded BEFORE this file:
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   ========================================================================= */

const SUPABASE_URL = "https://quigznvpwutsudxuqcvs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_GW8a38T9d3QtEFH1ZJGQiQ_qRUcvshM";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Marker/badge color per facility category — used on map.html and facility.html.
const categoryColors = {
  "Hospital": "#E64545",
  "Barangay Health Center": "#1C9A5B",
  "Medical Clinic": "#2E7DD6",
  "Pharmacy": "#9B59D0",
  "Dental Clinic": "#F0891E"
};

// Full service checklist per facility type — used for the Service filter accordion on map.html.
const serviceGroups = {
  "Dental Clinic": [
    "Dental Consultation", "Oral Examination", "Teeth Cleaning / Dental Prophylaxis",
    "Tooth Extraction", "Dental Filling / Restoration", "Root Canal Treatment",
    "Dental X-ray", "Dentures", "Braces / Orthodontic Treatment", "Oral Surgery",
    "Gum Treatment", "Fluoride Treatment", "Dental Sealants", "Emergency Dental Care"
  ],
  "Medical Clinic": [
    "General Consultation", "Physical Examination", "Vital Signs Monitoring",
    "Medical Check-up", "Diagnosis and Treatment", "Prescription / Medication Assistance",
    "Minor Wound Care", "Wound Dressing", "Injection Services", "Vaccination",
    "Medical Certificates", "Laboratory Test Requests", "Follow-up Consultation",
    "Chronic Disease Monitoring", "Health Counseling"
  ],
  "Hospital": [
    "Emergency Services", "Outpatient Consultation", "Inpatient / Admission",
    "General Medicine", "Pediatrics", "Obstetrics and Gynecology", "Surgery",
    "Internal Medicine", "Cardiology", "Dermatology", "Ophthalmology", "ENT Services",
    "Orthopedics", "Neurology", "Psychiatry / Mental Health Services",
    "Laboratory Services", "Blood Bank", "Diagnostic Imaging", "X-ray", "Ultrasound",
    "CT Scan", "MRI"
  ],
  "Barangay Health Center": [
    "General Health Consultation", "Maternal and Prenatal Care", "Child Health Services",
    "Immunization / Vaccination", "Family Planning", "Reproductive Health Services",
    "Nutrition Counseling", "Blood Pressure Monitoring", "Blood Sugar Monitoring",
    "Basic First Aid", "Wound Care", "Health Education", "Disease Prevention",
    "TB Screening / Treatment Programs", "Senior Citizen Health Services"
  ]
};

// ---------- Admin Authentication (Supabase Auth) ----------
// Requires Email/Password auth to be enabled in your Supabase project
// (Authentication > Providers > Email), and at least one admin user created
// there (Authentication > Users > Add User). Session is handled entirely by
// Supabase (stored in localStorage under the hood), so getAdminSession() and
// requireAdminAuth() will keep working across page reloads automatically.

// Logs in an admin. Returns { success: true, session } on success, or
// { success: false, message } on failure. Used by login.html.
async function loginAdmin(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("Login error:", error);
    return { success: false, message: error.message };
  }
  return { success: true, session: data.session };
}

// Logs out the current admin. Used by the "Logout" button in admin.html /
// manage.html.
async function logoutAdmin() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    console.error("Logout error:", error);
    return false;
  }
  return true;
}

// Returns the current session object, or null if no one is logged in.
async function getAdminSession() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("Error getting session:", error);
    return null;
  }
  return data.session;
}

// Guards an admin page: call this at the top of manage.html, admin.html,
// etc. If no one is logged in, redirects to login.html and returns null.
// If logged in, returns the session.
//
// IMPORTANT: this is async (it awaits a Supabase call), so it MUST be
// awaited — e.g.:
//   (async () => {
//     const session = await requireAdminAuth();
//     if (!session) return; // already redirecting to login.html
//     // ...rest of the page's admin logic here
//   })();
async function requireAdminAuth() {
  const session = await getAdminSession();

  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  return session;
}

// ---------- Data access functions (every page should go through these) ----------

// Returns all ACTIVE (non-archived) facilities. Used by map.html (markers +
// results list), facility.html ("Related Facilities"), the public site in
// general, and the Manage Facilities admin list.
async function getFacilities() {
  const { data, error } = await supabaseClient
    .from("facilities")
    .select("*")
    .is("archived_at", null)
    .order("id", { ascending: true });

  if (error) {
    console.error("Error fetching facilities:", error);
    return [];
  }
  return data;
}

// Returns ONE active facility by id, or null if not found, invalid id, or
// archived. Used by the public facility.html detail page.
async function getFacilityById(id) {
  const numId = Number(id);
  if (!numId) return null;

  const { data, error } = await supabaseClient
    .from("facilities")
    .select("*")
    .eq("id", numId)
    .is("archived_at", null)
    .maybeSingle();

  if (error) {
    console.error("Error fetching facility:", error);
    return null;
  }
  return data;
}

// Returns ONE facility by id regardless of archived status. Used by the
// admin Add/Edit Facility form, so an archived facility can still be edited
// if needed.
async function getFacilityByIdAdmin(id) {
  const numId = Number(id);
  if (!numId) return null;

  const { data, error } = await supabaseClient
    .from("facilities")
    .select("*")
    .eq("id", numId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching facility:", error);
    return null;
  }
  return data;
}

// Returns all ARCHIVED facilities, most recently archived first. Used by
// the Admin > Archived Facilities page.
async function getArchivedFacilities() {
  const { data, error } = await supabaseClient
    .from("facilities")
    .select("*")
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });

  if (error) {
    console.error("Error fetching archived facilities:", error);
    return [];
  }
  return data;
}

// Creates a new facility (no id) or updates an existing one (has id).
// Used by the Admin Add/Edit Facility form.
async function saveFacility(facility) {
  const { data, error } = await supabaseClient
    .from("facilities")
    .upsert(facility)
    .select();

  if (error) {
    console.error("Error saving facility:", error);
    return null;
  }
  return data;
}

// Moves a facility to the archive (soft delete). It disappears from the
// public site immediately but its data is kept, and it can be restored
// later from the Admin > Archived Facilities page.
async function archiveFacility(id) {
  const { error } = await supabaseClient
    .from("facilities")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", Number(id));

  if (error) {
    console.error("Error archiving facility:", error);
    return false;
  }
  return true;
}

// Restores a previously archived facility so it becomes publicly visible
// again.
async function restoreFacility(id) {
  const { error } = await supabaseClient
    .from("facilities")
    .update({ archived_at: null })
    .eq("id", Number(id));

  if (error) {
    console.error("Error restoring facility:", error);
    return false;
  }
  return true;
}

// Permanently deletes a facility. Only used from the Admin > Archived
// Facilities page ("Delete Permanently"), never from Manage Facilities
// directly — regular deletion there archives instead.
async function deleteFacilityPermanently(id) {
  const { error } = await supabaseClient
    .from("facilities")
    .delete()
    .eq("id", Number(id));

  if (error) {
    console.error("Error deleting facility:", error);
    return false;
  }
  return true;
}

// Shared Google Maps pin icon, colored per category — used on map.html and facility.html.
function pinIcon(color) {
  return {
    path: "M12 0C7.2 0 3.3 3.9 3.3 8.7c0 6.5 8.7 15.3 8.7 15.3s8.7-8.8 8.7-15.3C20.7 3.9 16.8 0 12 0z",
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 1.5,
    scale: 1.4,
    anchor: new google.maps.Point(12, 24)
  };
}

// Custom Google Maps style — used on map.html and facility.html.
const mapStyles = [
  { featureType: "administrative.land_parcel", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "labels.text", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] }
];

// =========================================================================
// Open/Closed status — computed live from operating_hours (per-day JSON) /
// is_24_hours / temporarily_closed, instead of a manual "open" toggle.
// The admin can still force a facility closed (holiday, renovation, etc.)
// via temporarily_closed.
//
// operating_hours shape (jsonb column):
// {
//   "Monday":    { "opens_at": "08:00", "closes_at": "17:00" },
//   ...
//   "Saturday":  { "opens_at": "08:00", "closes_at": "12:00" },
//   "Sunday":    null   // null / missing = closed that day
// }
// =========================================================================

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// True if the facility has at least one day with valid hours.
function hasHoursSet(facility) {
  const oh = facility.operating_hours;
  if (!oh) return false;
  return Object.values(oh).some(d => d && d.opens_at && d.closes_at);
}

// Returns { isOpen: boolean, label: string } for right now.
function getFacilityStatus(facility) {
  if (facility.temporarily_closed) {
    return { isOpen: false, label: "Temporarily Closed" };
  }
  if (facility.is_24_hours) {
    return { isOpen: true, label: "Open 24 Hours" };
  }
  if (!hasHoursSet(facility)) {
    return { isOpen: false, label: "Hours Not Set" };
  }

  const now = new Date();
  const todayName = DAY_NAMES[now.getDay()];
  const todayHours = facility.operating_hours[todayName];

  if (!todayHours || !todayHours.opens_at || !todayHours.closes_at) {
    return { isOpen: false, label: "Closed Today" };
  }

  const [openH, openM] = todayHours.opens_at.split(':').map(Number);
  const [closeH, closeM] = todayHours.closes_at.split(':').map(Number);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  const isOpen = nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  return { isOpen, label: isOpen ? "Open Now" : "Closed" };
}

// Formats a "HH:MM" (or "HH:MM:SS") time string into "8:00 AM" style.
function formatTime(t) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

// Builds the "Day - Time" breakdown for display. Consecutive days with the
// exact same hours are grouped into one row (e.g. Monday–Friday); days with
// different hours (e.g. Saturday) get their own row. Returns:
// [ { label: "Monday–Friday", time: "8:00 AM – 5:00 PM" },
//   { label: "Saturday",      time: "8:00 AM – 12:00 PM" },
//   { label: "Sunday",        time: "Closed" } ]
function getHoursBreakdown(facility) {
  if (facility.is_24_hours) {
    return [{ label: "Every day", time: "Open 24 Hours" }];
  }
  if (!hasHoursSet(facility)) {
    return [{ label: "Hours", time: "Not set" }];
  }

  const oh = facility.operating_hours;
  const rows = DAY_ORDER.map(day => {
    const entry = oh[day];
    const time = (entry && entry.opens_at && entry.closes_at)
      ? `${formatTime(entry.opens_at)} – ${formatTime(entry.closes_at)}`
      : "Closed";
    return { day, time };
  });

  const grouped = [];
  rows.forEach(row => {
    const last = grouped[grouped.length - 1];
    if (last && last.time === row.time) {
      last.days.push(row.day);
    } else {
      grouped.push({ time: row.time, days: [row.day] });
    }
  });

  return grouped.map(g => ({
    label: g.days.length > 1 ? `${g.days[0]}–${g.days[g.days.length - 1]}` : g.days[0],
    time: g.time
  }));
}

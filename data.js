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

// ---------- Data access functions (every page should go through these) ----------

// Returns ALL facilities. Used by map.html (markers + results list) and
// facility.html (to build the "Related Facilities" section).
async function getFacilities() {
  const { data, error } = await supabaseClient
    .from("facilities")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    console.error("Error fetching facilities:", error);
    return [];
  }
  return data;
}

// Returns ONE facility by id, or null if not found / invalid id.
async function getFacilityById(id) {
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

// Creates a new facility (no id) or updates an existing one (has id).
// Not used yet by map.html / facility.html — this is here ready for
// the Add/Edit Health Facility admin page.
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

// Deletes a facility by id. Ready for the Admin > Manage Facilities page.
async function deleteFacility(id) {
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

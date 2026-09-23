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

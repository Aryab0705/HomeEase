/**
 * Calculate Haversine distance between two coordinates in meters
 * @param {number} lat1 Latitude of point 1
 * @param {number} lon1 Longitude of point 1
 * @param {number} lat2 Latitude of point 2
 * @param {number} lon2 Longitude of point 2
 * @returns {{ distanceKm: number, distanceMeters: number }}
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return { distanceKm: null, distanceMeters: null };
  }

  const p1Lat = Number(lat1);
  const p1Lon = Number(lon1);
  const p2Lat = Number(lat2);
  const p2Lon = Number(lon2);

  if (isNaN(p1Lat) || isNaN(p1Lon) || isNaN(p2Lat) || isNaN(p2Lon)) {
    return { distanceKm: null, distanceMeters: null };
  }

  const R = 6371; // Earth radius in km
  const dLat = ((p2Lat - p1Lat) * Math.PI) / 180;
  const dLon = ((p2Lon - p1Lon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1Lat * Math.PI) / 180) *
      Math.cos((p2Lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;
  const distanceMeters = distanceKm * 1000;

  return {
    distanceKm: Number(distanceKm.toFixed(3)),
    distanceMeters: Math.round(distanceMeters),
  };
}

/**
 * Check if provider has reached destination geofence (<= 100m)
 * Updates booking status to arrived if conditions are met and persists in MongoDB.
 */
async function evaluateArrivalGeofence(booking, provLat, provLng, radiusMeters = 100) {
  const custLat = booking.customerLocation?.latitude ?? booking.address?.coordinates?.lat;
  const custLng = booking.customerLocation?.longitude ?? booking.address?.coordinates?.lng;

  if (custLat == null || custLng == null) {
    console.warn(`?? [Geofence] Destination location unavailable for booking ${booking._id}`);
    return {
      statusChanged: false,
      distanceMeters: null,
      distanceKm: null,
      custLat: null,
      custLng: null,
      reason: "Destination location unavailable",
    };
  }

  if (provLat == null || provLng == null) {
    return {
      statusChanged: false,
      distanceMeters: null,
      distanceKm: null,
      custLat,
      custLng,
      reason: "Provider location unavailable",
    };
  }

  const { distanceKm, distanceMeters } = calculateHaversineDistance(provLat, provLng, custLat, custLng);

  console.log(`?? [Geofence Check] Booking ${booking._id}:`);
  console.log(`   - Provider Coords:    lat=${provLat}, lng=${provLng}`);
  console.log(`   - Destination Coords: lat=${custLat}, lng=${custLng}`);
  console.log(`   - Distance:           ${distanceMeters}m (${distanceKm}km)`);
  console.log(`   - Arrival Radius:     ${radiusMeters}m`);
  console.log(`   - Current Status:     ${booking.status}`);

  let statusChanged = false;
  if (booking.status === "on_the_way" && distanceMeters != null && distanceMeters <= radiusMeters) {
    booking.status = "arrived";
    booking.providerArrivedAt = new Date();
    booking.providerArrivalLatitude = Number(provLat);
    booking.providerArrivalLongitude = Number(provLng);
    booking.arrivalDistanceMeters = Number(distanceMeters);

    if (!booking.statusHistory) booking.statusHistory = [];
    booking.statusHistory.push({
      status: "arrived",
      note: `Auto-transitioned: Provider reached destination (${distanceMeters}m <= ${radiusMeters}m radius). Arrival coords: (${provLat}, ${provLng}).`,
      changedAt: new Date(),
    });
    booking.markModified("status");
    booking.markModified("statusHistory");
    booking.markModified("providerArrivedAt");
    booking.markModified("providerArrivalLatitude");
    booking.markModified("providerArrivalLongitude");
    booking.markModified("arrivalDistanceMeters");
    await booking.save();
    statusChanged = true;
    console.log(`?? [Geofence ARRIVED] Booking ${booking._id} transitioned to ARRIVED with arrival evidence saved!`);
  }

  return {
    statusChanged,
    distanceMeters,
    distanceKm,
    custLat,
    custLng,
  };
}

module.exports = {
  calculateHaversineDistance,
  evaluateArrivalGeofence,
};

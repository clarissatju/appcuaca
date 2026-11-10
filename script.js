/**
 * WeatherNow – script.js
 * Vanilla JS weather app using Open-Meteo & Geocoding APIs.
 * No API key required.
 */

'use strict';

// =====================================================
// API ENDPOINTS
// =====================================================
const GEOCODING_URL =
  'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast';

// =====================================================
// STATE
// =====================================================
const state = {
  unit: 'C',           // 'C' or 'F'
  weatherData: null,   // raw API response
  cityInfo: null,      // { name, country, latitude, longitude }
};

// =====================================================
// DOM REFERENCES
// =====================================================
const els = {
  searchInput:   document.getElementById('search-input'),
  searchBtn:     document.getElementById('search-btn'),
  suggestionsList: document.getElementById('suggestions-list'),
  btnCelsius:    document.getElementById('btn-celsius'),
  btnFahrenheit: document.getElementById('btn-fahrenheit'),

  welcomeState:  document.getElementById('welcome-state'),
  loadingState:  document.getElementById('loading-state'),
  errorState:    document.getElementById('error-state'),
  errorTitle:    document.getElementById('error-title'),
  errorMessage:  document.getElementById('error-message'),
  weatherContent:document.getElementById('weather-content'),

  cityName:      document.getElementById('city-name'),
  countryName:   document.getElementById('country-name'),
  currentDate:   document.getElementById('current-date'),
  currentIcon:   document.getElementById('current-weather-icon'),
  currentTemp:   document.getElementById('current-temp'),
  tempUnitLabel: document.getElementById('temp-unit-label'),
  currentCondition: document.getElementById('current-condition'),
  feelsLikeVal:  document.getElementById('feels-like-val'),
  humidityVal:   document.getElementById('humidity-val'),
  windVal:       document.getElementById('wind-val'),
  precipVal:     document.getElementById('precip-val'),

  sunriseVal:    document.getElementById('sunrise-val'),
  sunsetVal:     document.getElementById('sunset-val'),
  uvVal:         document.getElementById('uv-val'),
  humidityDetailVal: document.getElementById('humidity-detail-val'),
  windDetailVal: document.getElementById('wind-detail-val'),
  rainChanceVal: document.getElementById('rain-chance-val'),

  hourlyTrack:   document.getElementById('hourly-track'),
  dailyList:     document.getElementById('daily-list'),
};

// =====================================================
// WEATHER CODE MAPPINGS
// =====================================================
/**
 * Returns a human-readable description for an Open-Meteo WMO code.
 * @param {number} code
 * @returns {string}
 */
function getWeatherDescription(code) {
  const descriptions = {
    0:  'Clear Sky',
    1:  'Mainly Clear',
    2:  'Partly Cloudy',
    3:  'Overcast',
    45: 'Foggy',
    48: 'Icy Fog',
    51: 'Light Drizzle',
    53: 'Moderate Drizzle',
    55: 'Dense Drizzle',
    56: 'Light Freezing Drizzle',
    57: 'Heavy Freezing Drizzle',
    61: 'Slight Rain',
    63: 'Moderate Rain',
    65: 'Heavy Rain',
    66: 'Light Freezing Rain',
    67: 'Heavy Freezing Rain',
    71: 'Light Snow',
    73: 'Moderate Snow',
    75: 'Heavy Snow',
    77: 'Snow Grains',
    80: 'Slight Rain Showers',
    81: 'Moderate Rain Showers',
    82: 'Violent Rain Showers',
    85: 'Light Snow Showers',
    86: 'Heavy Snow Showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with Hail',
    99: 'Thunderstorm with Heavy Hail',
  };
  return descriptions[code] ?? 'Unknown';
}

/**
 * Returns an emoji icon for an Open-Meteo WMO code.
 * @param {number} code
 * @param {boolean} isDay
 * @returns {string}
 */
function getWeatherIcon(code, isDay = true) {
  if (code === 0)              return isDay ? '☀️' : '🌙';
  if (code === 1)              return isDay ? '🌤️' : '🌤️';
  if (code === 2)              return '⛅';
  if (code === 3)              return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 57)   return '🌦️';
  if (code >= 61 && code <= 67)   return '🌧️';
  if (code >= 71 && code <= 77)   return '❄️';
  if (code >= 80 && code <= 82)   return '🌧️';
  if (code === 85 || code === 86) return '🌨️';
  if (code >= 95 && code <= 99)   return '⛈️';
  return '🌡️';
}

// =====================================================
// UNIT CONVERSION
// =====================================================
/**
 * Converts a Celsius temperature value to the active unit.
 * @param {number} celsius - Temperature in Celsius (as returned by API)
 * @returns {string} Formatted number string
 */
function convertTemperature(celsius) {
  if (state.unit === 'F') {
    return Math.round((celsius * 9) / 5 + 32).toString();
  }
  return Math.round(celsius).toString();
}

// =====================================================
// UI STATE HELPERS
// =====================================================
function showLoading() {
  els.welcomeState.classList.add('hidden');
  els.errorState.classList.add('hidden');
  els.weatherContent.classList.add('hidden');
  els.loadingState.classList.remove('hidden');
}

function showError(title, message) {
  els.loadingState.classList.add('hidden');
  els.welcomeState.classList.add('hidden');
  els.weatherContent.classList.add('hidden');
  els.errorTitle.textContent = title;
  els.errorMessage.textContent = message;
  els.errorState.classList.remove('hidden');
}

function showWeather() {
  els.loadingState.classList.add('hidden');
  els.welcomeState.classList.add('hidden');
  els.errorState.classList.add('hidden');
  els.weatherContent.classList.remove('hidden');
}

// =====================================================
// CITY SEARCH & GEOCODING
// =====================================================
/**
 * Searches the Open-Meteo Geocoding API for a city name.
 * Updates the suggestions dropdown.
 */
async function searchCity() {
  const query = els.searchInput.value.trim();
  if (!query) return;

  showLoading();
  closeSuggestions();

  try {
    const url = `${GEOCODING_URL}?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      showError(
        'City Not Found',
        `We couldn't find any city matching "${query}". Please check the spelling and try again.`
      );
      return;
    }

    // If only one result, go straight to weather fetch
    if (data.results.length === 1) {
      selectCity(data.results[0]);
      return;
    }

    // Multiple results → show suggestions
    // Hide loading so user can see the header again
    els.loadingState.classList.add('hidden');
    els.welcomeState.classList.add('hidden');

    renderSuggestions(data.results);

  } catch (err) {
    console.error(err);
    if (!navigator.onLine) {
      showError('No Internet Connection', 'Please check your connection and try again.');
    } else {
      showError('Search Failed', 'Unable to reach the geocoding service. Please try again later.');
    }
  }
}

/**
 * Renders city suggestion items in the dropdown.
 * @param {Array} results
 */
function renderSuggestions(results) {
  els.suggestionsList.innerHTML = '';

  results.forEach((city) => {
    const li = document.createElement('li');
    li.className = 'suggestion-item';
    li.setAttribute('role', 'option');
    li.setAttribute('tabindex', '0');

    const parts = [city.name];
    if (city.admin1) parts.push(city.admin1);
    if (city.country) parts.push(city.country);

    li.innerHTML = `
      <div class="city-suggestion">${city.name}</div>
      <div class="region-suggestion">${parts.slice(1).join(', ')}</div>
    `;

    li.addEventListener('click', () => selectCity(city));
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectCity(city);
      }
    });

    els.suggestionsList.appendChild(li);
  });

  els.suggestionsList.classList.remove('hidden');
}

/**
 * Closes the suggestions dropdown.
 */
function closeSuggestions() {
  els.suggestionsList.classList.add('hidden');
  els.suggestionsList.innerHTML = '';
}

/**
 * Stores selected city info and triggers weather fetch.
 * @param {Object} city - Geocoding result object
 */
function selectCity(city) {
  closeSuggestions();
  state.cityInfo = {
    name:      city.name,
    country:   city.country ?? '',
    latitude:  city.latitude,
    longitude: city.longitude,
  };
  els.searchInput.value = city.name;
  fetchWeather(city.latitude, city.longitude);
}

// =====================================================
// WEATHER DATA FETCH
// =====================================================
/**
 * Fetches full weather data from Open-Meteo forecast API.
 * @param {number} lat
 * @param {number} lon
 */
async function fetchWeather(lat, lon) {
  showLoading();

  const params = new URLSearchParams({
    latitude:  lat,
    longitude: lon,
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'is_day',
      'precipitation',
      'weather_code',
      'wind_speed_10m',
    ].join(','),
    hourly: [
      'temperature_2m',
      'precipitation_probability',
      'weather_code',
    ].join(','),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'sunrise',
      'sunset',
      'uv_index_max',
      'precipitation_probability_max',
    ].join(','),
    timezone: 'auto',
    forecast_days: 7,
  });

  try {
    const response = await fetch(`${WEATHER_URL}?${params}`);

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.current || !data.hourly || !data.daily) {
      throw new Error('Incomplete weather data received.');
    }

    state.weatherData = data;
    renderAllWeather();
    showWeather();

  } catch (err) {
    console.error(err);
    if (!navigator.onLine) {
      showError('No Internet Connection', 'Please check your connection and try again.');
    } else {
      showError('Weather Unavailable', 'Could not load weather data. Please try again in a moment.');
    }
  }
}

// =====================================================
// RENDER FUNCTIONS
// =====================================================

/**
 * Master render: calls all section-specific render functions.
 */
function renderAllWeather() {
  displayCurrentWeather();
  displayWeatherDetails();
  displayHourlyForecast();
  displayDailyForecast();
}

/**
 * Displays the current weather card.
 */
function displayCurrentWeather() {
  const { current, daily } = state.weatherData;
  const { name, country } = state.cityInfo;

  const code    = current.weather_code;
  const isDay   = current.is_day === 1;
  const tempC   = current.temperature_2m;
  const feelsC  = current.apparent_temperature;

  // Location
  els.cityName.textContent    = name;
  els.countryName.textContent = country;
  els.currentDate.textContent = formatFullDate(new Date());

  // Temperature & icon
  els.currentIcon.textContent      = getWeatherIcon(code, isDay);
  els.currentTemp.textContent      = convertTemperature(tempC);
  els.tempUnitLabel.textContent    = state.unit === 'C' ? '°C' : '°F';
  els.currentCondition.textContent = getWeatherDescription(code);

  // Meta row
  els.feelsLikeVal.textContent = `${convertTemperature(feelsC)}°${state.unit}`;
  els.humidityVal.textContent  = `${current.relative_humidity_2m}%`;
  els.windVal.textContent      = `${current.wind_speed_10m} km/h`;
  els.precipVal.textContent    = `${current.precipitation} mm`;
}

/**
 * Displays the detail cards (sunrise, sunset, UV, humidity, wind, rain chance).
 */
function displayWeatherDetails() {
  const { current, daily } = state.weatherData;
  const todayIdx = 0; // first day is today

  els.sunriseVal.textContent       = formatTime(daily.sunrise[todayIdx]);
  els.sunsetVal.textContent        = formatTime(daily.sunset[todayIdx]);
  els.uvVal.textContent            = daily.uv_index_max[todayIdx]?.toFixed(1) ?? '—';
  els.humidityDetailVal.textContent= `${current.relative_humidity_2m}%`;
  els.windDetailVal.textContent    = `${current.wind_speed_10m} km/h`;
  els.rainChanceVal.textContent    = `${daily.precipitation_probability_max[todayIdx] ?? 0}%`;
}

/**
 * Displays the next 24 hourly forecast cards.
 */
function displayHourlyForecast() {
  const { hourly } = state.weatherData;
  els.hourlyTrack.innerHTML = '';

  // Find current hour index
  const nowHour     = new Date().getHours();
  const currentHourIdx = hourly.time.findIndex((t) => {
    const h = new Date(t).getHours();
    // Match the first occurrence of the current hour on today
    return h === nowHour && new Date(t).toDateString() === new Date().toDateString();
  });
  const startIdx = currentHourIdx >= 0 ? currentHourIdx : 0;

  // Show 24 hours starting from now
  const slice = hourly.time.slice(startIdx, startIdx + 24);

  slice.forEach((timeStr, i) => {
    const idx    = startIdx + i;
    const tempC  = hourly.temperature_2m[idx];
    const precip = hourly.precipitation_probability[idx] ?? 0;
    const code   = hourly.weather_code[idx];
    const hour   = new Date(timeStr).getHours();
    const isDay  = hour >= 6 && hour < 20;

    const card = document.createElement('div');
    card.className = 'hourly-card' + (i === 0 ? ' current-hour' : '');
    card.innerHTML = `
      <span class="hourly-time">${i === 0 ? 'Now' : formatHour(timeStr)}</span>
      <span class="hourly-icon">${getWeatherIcon(code, isDay)}</span>
      <span class="hourly-temp">${convertTemperature(tempC)}°${state.unit}</span>
      <span class="hourly-precip">💧 ${precip}%</span>
    `;
    els.hourlyTrack.appendChild(card);
  });
}

/**
 * Displays the 7-day daily forecast list.
 */
function displayDailyForecast() {
  const { daily } = state.weatherData;
  els.dailyList.innerHTML = '';

  daily.time.forEach((dateStr, i) => {
    const code   = daily.weather_code[i];
    const maxC   = daily.temperature_2m_max[i];
    const minC   = daily.temperature_2m_min[i];
    const precip = daily.precipitation_probability_max[i] ?? 0;
    const label  = i === 0 ? 'Today' : formatDayName(dateStr);

    const row = document.createElement('div');
    row.className = 'daily-row';
    row.setAttribute('role', 'listitem');
    row.innerHTML = `
      <span class="daily-day">${label}</span>
      <span class="daily-icon">${getWeatherIcon(code, true)}</span>
      <span class="daily-condition">${getWeatherDescription(code)}</span>
      <div class="daily-temps">
        <span class="daily-max">${convertTemperature(maxC)}°${state.unit}</span>
        <span class="daily-min">${convertTemperature(minC)}°${state.unit}</span>
      </div>
      <span class="daily-precip">💧 ${precip}%</span>
    `;
    els.dailyList.appendChild(row);
  });
}

// =====================================================
// TEMPERATURE UNIT TOGGLE
// =====================================================
/**
 * Switches between Celsius and Fahrenheit and re-renders temperatures.
 * No additional API call is made.
 * @param {'C'|'F'} unit
 */
function switchUnit(unit) {
  if (state.unit === unit) return;
  state.unit = unit;

  // Update toggle button states
  els.btnCelsius.classList.toggle('active', unit === 'C');
  els.btnFahrenheit.classList.toggle('active', unit === 'F');
  els.btnCelsius.setAttribute('aria-pressed', unit === 'C');
  els.btnFahrenheit.setAttribute('aria-pressed', unit === 'F');

  // Re-render all temperature displays if data exists
  if (state.weatherData) {
    displayCurrentWeather();
    displayHourlyForecast();
    displayDailyForecast();
  }
}

// =====================================================
// DATE / TIME HELPERS
// =====================================================
/**
 * Returns a formatted full date string, e.g. "Tuesday, 10 November 2026".
 * @param {Date} date
 */
function formatFullDate(date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Returns the hour label for an ISO time string, e.g. "14:00".
 * @param {string} timeStr ISO datetime string
 */
function formatHour(timeStr) {
  return new Date(timeStr).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Returns the short day name for a date string, e.g. "Wed".
 * @param {string} dateStr  "YYYY-MM-DD"
 */
function formatDayName(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long',
  });
}

/**
 * Formats a sunrise/sunset ISO string to "HH:MM".
 * @param {string} isoStr
 */
function formatTime(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// =====================================================
// EVENT LISTENERS
// =====================================================

// Search button click
els.searchBtn.addEventListener('click', searchCity);

// Enter key in search input
els.searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    closeSuggestions();
    searchCity();
  }
  // Arrow down into suggestions
  if (e.key === 'ArrowDown') {
    const first = els.suggestionsList.querySelector('.suggestion-item');
    if (first) first.focus();
  }
});

// Close suggestions when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-wrapper')) {
    closeSuggestions();
  }
});

// Unit toggle
els.btnCelsius.addEventListener('click', () => switchUnit('C'));
els.btnFahrenheit.addEventListener('click', () => switchUnit('F'));

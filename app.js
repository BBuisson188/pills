const STORAGE_KEY = "recovery-med-tracker-v1";
const NOTIFICATION_STORAGE_KEY = "recovery-med-tracker-notifications";
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const defaultMedications = [
  {
    id: crypto.randomUUID(),
    name: "Tylenol / acetaminophen",
    doseLabel: "1000 mg",
    intervalHours: 6,
    dailyMax: null,
    notes: "Often alternated with Motrin every 3 hours.",
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    name: "Motrin / ibuprofen",
    doseLabel: "600 mg",
    intervalHours: 6,
    dailyMax: null,
    notes: "Often alternated with Tylenol every 3 hours.",
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    name: "Gas-X / simethicone",
    doseLabel: "1 dose",
    intervalHours: 4,
    dailyMax: null,
    notes: "Editable range. Default set to 4 hours for earliest allowed time.",
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    name: "Colace / docusate",
    doseLabel: "1 dose",
    intervalHours: 12,
    dailyMax: 2,
    notes: "Editable for once or twice daily use.",
    createdAt: new Date().toISOString(),
  },
];

const state = loadState();

const elements = {
  tabButtons: [...document.querySelectorAll(".tab-button")],
  tabPanels: [...document.querySelectorAll(".tab-panel")],
  quickAddGrid: document.getElementById("quickAddGrid"),
  medicationStatusList: document.getElementById("medicationStatusList"),
  alternationHelper: document.getElementById("alternationHelper"),
  historyList: document.getElementById("historyList"),
  settingsMedicationList: document.getElementById("settingsMedicationList"),
  nextMedicationName: document.getElementById("nextMedicationName"),
  nextMedicationTime: document.getElementById("nextMedicationTime"),
  nextMedicationCountdown: document.getElementById("nextMedicationCountdown"),
  doseForm: document.getElementById("doseForm"),
  entryId: document.getElementById("entryId"),
  medicationId: document.getElementById("medicationId"),
  doseAmount: document.getElementById("doseAmount"),
  takenAt: document.getElementById("takenAt"),
  entryNotes: document.getElementById("entryNotes"),
  saveEntryButton: document.getElementById("saveEntryButton"),
  resetFormButton: document.getElementById("resetFormButton"),
  exportButton: document.getElementById("exportButton"),
  importInput: document.getElementById("importInput"),
  enableNotificationsButton: document.getElementById("enableNotificationsButton"),
  notificationStatus: document.getElementById("notificationStatus"),
  warningDialog: document.getElementById("warningDialog"),
  warningMessage: document.getElementById("warningMessage"),
  customMedicationForm: document.getElementById("customMedicationForm"),
  customName: document.getElementById("customName"),
  customDose: document.getElementById("customDose"),
  customInterval: document.getElementById("customInterval"),
  customDailyMax: document.getElementById("customDailyMax"),
  customNotes: document.getElementById("customNotes"),
};

let countdownTimer = null;

initialize();

function initialize() {
  bindEvents();
  if (!state.ui.lastNotificationMap) {
    state.ui.lastNotificationMap = {};
  }
  renderAll();
  startCountdownTicker();
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return {
        medications: defaultMedications,
        entries: [],
        ui: {
          notificationPermissionRequested: false,
          notificationsEnabled: readNotificationPreference(),
          lastNotificationMap: {},
        },
      };
    }

    const parsed = JSON.parse(stored);
    return {
      medications: Array.isArray(parsed.medications) && parsed.medications.length
        ? parsed.medications
        : defaultMedications,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      ui: {
        notificationPermissionRequested:
          parsed.ui?.notificationPermissionRequested ?? false,
        notificationsEnabled:
          parsed.ui?.notificationsEnabled ?? readNotificationPreference(),
        lastNotificationMap: parsed.ui?.lastNotificationMap ?? {},
      },
    };
  } catch (error) {
    console.error("Failed to load state:", error);
    return {
      medications: defaultMedications,
      entries: [],
      ui: {
        notificationPermissionRequested: false,
        notificationsEnabled: false,
        lastNotificationMap: {},
      },
    };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  localStorage.setItem(
    NOTIFICATION_STORAGE_KEY,
    JSON.stringify(Boolean(state.ui.notificationsEnabled))
  );
}

function readNotificationPreference() {
  try {
    return JSON.parse(localStorage.getItem(NOTIFICATION_STORAGE_KEY) ?? "false");
  } catch {
    return false;
  }
}

function bindEvents() {
  elements.tabButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });

  elements.doseForm.addEventListener("submit", handleDoseSubmit);
  elements.resetFormButton.addEventListener("click", resetDoseForm);
  elements.exportButton.addEventListener("click", exportData);
  elements.importInput.addEventListener("change", importData);
  elements.enableNotificationsButton.addEventListener(
    "click",
    handleNotificationRequest
  );
  elements.customMedicationForm.addEventListener(
    "submit",
    handleCustomMedicationSubmit
  );
  elements.medicationId.addEventListener("change", () => {
    elements.doseAmount.value = "";
    syncDoseFieldToMedication();
  });
}

function setActiveTab(tabName) {
  elements.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
  elements.tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tabName);
  });
}

function renderAll() {
  renderMedicationOptions();
  renderQuickButtons();
  renderStatusCards();
  renderAlternationHelper();
  renderHistory();
  renderSettings();
  renderNextMedicationCard();
  renderNotificationState();
  maybeSendNotifications();
  saveState();
}

function renderMedicationOptions() {
  const currentSelection = elements.medicationId.value;
  elements.medicationId.innerHTML = "";

  state.medications
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((medication) => {
      const option = document.createElement("option");
      option.value = medication.id;
      option.textContent = medication.name;
      elements.medicationId.append(option);
    });

  if (currentSelection && state.medications.some((med) => med.id === currentSelection)) {
    elements.medicationId.value = currentSelection;
  } else if (state.medications[0]) {
    elements.medicationId.value = state.medications[0].id;
  }

  syncDoseFieldToMedication();
}

function renderQuickButtons() {
  elements.quickAddGrid.innerHTML = "";
  const template = document.getElementById("quickAddTemplate");

  state.medications.forEach((medication) => {
    const fragment = template.content.cloneNode(true);
    const button = fragment.querySelector(".quick-button");
    fragment.querySelector(".quick-name").textContent = medication.name;
    fragment.querySelector(".quick-dose").textContent = medication.doseLabel;

    button.addEventListener("click", () => {
      const entry = {
        id: crypto.randomUUID(),
        medicationId: medication.id,
        doseAmount: medication.doseLabel,
        takenAt: new Date().toISOString(),
        notes: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const warnings = collectWarnings(entry, medication);
      if (warnings.length) {
        showWarningDialog(warnings, () => saveEntry(entry));
        return;
      }

      saveEntry(entry);
      setActiveTab("tracker");
    });

    elements.quickAddGrid.append(fragment);
  });
}

function renderStatusCards() {
  elements.medicationStatusList.innerHTML = "";
  const template = document.getElementById("statusCardTemplate");

  getMedicationSummaries().forEach((summary) => {
    const fragment = template.content.cloneNode(true);
    const availability = fragment.querySelector(".status-availability");
    fragment.querySelector(".status-name").textContent = summary.medication.name;
    fragment.querySelector(".status-notes").textContent =
      summary.medication.notes || "No additional notes.";
    availability.textContent = !summary.hasHistory
      ? "Ready to log - no doses recorded yet"
      : summary.isAvailable
        ? `Available now${summary.isAlternationCue ? " - good alternation checkpoint" : ""}`
        : `Not yet available - ${formatRelativeTime(summary.nextAllowedAt)}`;
    availability.classList.add(summary.isAvailable ? "available" : "waiting");
    fragment.querySelector(".status-last").textContent = summary.lastTakenAt
      ? `Last dose: ${formatTimestamp(summary.lastTakenAt)}`
      : "Last dose: none logged";
    fragment.querySelector(".status-next").textContent = `Next allowed: ${formatTimestamp(
      summary.nextAllowedAt
    )}`;

    elements.medicationStatusList.append(fragment);
  });
}

function renderNextMedicationCard() {
  const summaries = getMedicationSummaries();
  if (!summaries.length) {
    elements.nextMedicationName.textContent = "No medications configured";
    elements.nextMedicationTime.textContent = "Add a medication in settings.";
    elements.nextMedicationCountdown.textContent = "";
    return;
  }

  const activeSummaries = summaries.filter((summary) => summary.hasHistory);

  if (!activeSummaries.length) {
    elements.nextMedicationName.textContent = "No doses logged yet";
    elements.nextMedicationTime.textContent = "Use Quick add or the manual form to start tracking.";
    elements.nextMedicationCountdown.textContent = "";
    return;
  }

  const nextSummary = activeSummaries
    .slice()
    .sort(
      (a, b) =>
        a.nextAllowedAt - b.nextAllowedAt ||
        a.medication.name.localeCompare(b.medication.name)
    )[0];

  elements.nextMedicationName.textContent = nextSummary.medication.name;
  elements.nextMedicationTime.textContent = nextSummary.isAvailable
    ? `Available now - next allowed since ${formatTimestamp(nextSummary.nextAllowedAt)}`
    : `Allowed at ${formatTimestamp(nextSummary.nextAllowedAt)}`;
  elements.nextMedicationCountdown.textContent = nextSummary.isAvailable
    ? "You can log this now if it matches your instructions."
    : `Countdown: ${formatCountdown(nextSummary.nextAllowedAt - Date.now())}`;
}

function renderAlternationHelper() {
  const tylenol = state.medications.find((medication) =>
    medication.name.toLowerCase().includes("tylenol")
  );
  const motrin = state.medications.find((medication) =>
    medication.name.toLowerCase().includes("motrin")
  );

  if (!(tylenol && motrin)) {
    elements.alternationHelper.innerHTML =
      '<p class="muted-text">Add both Tylenol and Motrin to see the alternation helper.</p>';
    return;
  }

  const tylenolLast = getLastEntryForMedication(tylenol.id);
  const motrinLast = getLastEntryForMedication(motrin.id);
  const mostRecent = [tylenolLast, motrinLast]
    .filter(Boolean)
    .sort((a, b) => new Date(b.takenAt) - new Date(a.takenAt))[0];

  if (!mostRecent) {
    elements.alternationHelper.innerHTML =
      "<p>Once you log Tylenol or Motrin, this section will show the next 3-hour alternation checkpoint.</p>";
    return;
  }

  const recentMedication = findMedication(mostRecent.medicationId);
  const nextCheckpoint = new Date(new Date(mostRecent.takenAt).getTime() + 3 * MS_PER_HOUR);

  elements.alternationHelper.innerHTML = `
    <p><strong>Most recent alternating med:</strong> ${recentMedication?.name ?? "Medication"} at ${formatTimestamp(
      mostRecent.takenAt
    )}</p>
    <p><strong>3-hour checkpoint:</strong> ${formatTimestamp(nextCheckpoint)}</p>
    <p class="muted-text">This is only a visual aid for alternation. Each medication's own next allowed time still follows its saved repeat interval.</p>
  `;
}

function renderHistory() {
  elements.historyList.innerHTML = "";
  const template = document.getElementById("historyItemTemplate");
  const entries = getSortedEntries();

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "muted-text";
    empty.textContent = "No doses logged yet.";
    elements.historyList.append(empty);
    return;
  }

  entries.forEach((entry) => {
    const medication = findMedication(entry.medicationId);
    const fragment = template.content.cloneNode(true);
    fragment.querySelector(".history-name").textContent =
      medication?.name ?? "Deleted medication";
    fragment.querySelector(".history-dose").textContent = `Dose: ${entry.doseAmount}`;
    fragment.querySelector(".history-time").textContent = formatTimestamp(entry.takenAt);
    fragment.querySelector(".history-notes").textContent = entry.notes
      ? `Notes: ${entry.notes}`
      : "Notes: none";

    fragment.querySelector(".history-edit").addEventListener("click", () => {
      populateFormForEdit(entry);
      setActiveTab("tracker");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    fragment.querySelector(".history-delete").addEventListener("click", () => {
      if (!window.confirm("Delete this dose entry?")) {
        return;
      }
      state.entries = state.entries.filter((item) => item.id !== entry.id);
      renderAll();
    });

    elements.historyList.append(fragment);
  });
}

function renderSettings() {
  elements.settingsMedicationList.innerHTML = "";
  const template = document.getElementById("settingsItemTemplate");

  state.medications
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((medication) => {
      const fragment = template.content.cloneNode(true);
      fragment.querySelector(".settings-name").textContent = medication.name;
      fragment.querySelector(".settings-meta").textContent = `Last dose: ${
        getLastEntryForMedication(medication.id)
          ? formatTimestamp(getLastEntryForMedication(medication.id).takenAt)
          : "none logged"
      }`;

      const doseInput = fragment.querySelector(".settings-dose");
      const intervalInput = fragment.querySelector(".settings-interval");
      const maxInput = fragment.querySelector(".settings-max");
      const notesInput = fragment.querySelector(".settings-notes");

      doseInput.value = medication.doseLabel;
      intervalInput.value = medication.intervalHours;
      maxInput.value = medication.dailyMax ?? "";
      notesInput.value = medication.notes ?? "";

      fragment.querySelector(".settings-save").addEventListener("click", () => {
        medication.doseLabel = doseInput.value.trim() || medication.doseLabel;
        medication.intervalHours = sanitizeNumber(intervalInput.value, medication.intervalHours);
        medication.dailyMax = maxInput.value ? sanitizeNumber(maxInput.value, null) : null;
        medication.notes = notesInput.value.trim();
        renderAll();
      });

      fragment.querySelector(".settings-remove").addEventListener("click", () => {
        const hasEntries = state.entries.some((entry) => entry.medicationId === medication.id);
        const message = hasEntries
          ? "Delete this medication and keep old history entries marked as deleted medication?"
          : "Delete this medication?";
        if (!window.confirm(message)) {
          return;
        }
        state.medications = state.medications.filter((item) => item.id !== medication.id);
        if (elements.medicationId.value === medication.id) {
          resetDoseForm();
        }
        renderAll();
      });

      elements.settingsMedicationList.append(fragment);
    });
}

function renderNotificationState() {
  if (!("Notification" in window)) {
    elements.notificationStatus.textContent =
      "This browser does not support notifications.";
    elements.enableNotificationsButton.disabled = true;
    return;
  }

  const permission = Notification.permission;
  const enabled = state.ui.notificationsEnabled && permission === "granted";
  elements.enableNotificationsButton.disabled = permission === "denied";
  elements.notificationStatus.textContent = enabled
    ? "Notifications enabled. The app can notify when a medication becomes available while the browser is active enough to run."
    : permission === "denied"
      ? "Notifications are blocked in this browser."
      : "Notifications are off. You can still rely on the on-screen countdowns.";
}

function handleDoseSubmit(event) {
  event.preventDefault();
  const medication = findMedication(elements.medicationId.value);
  if (!medication) {
    return;
  }

  const takenAt = new Date(elements.takenAt.value);
  const entry = {
    id: elements.entryId.value || crypto.randomUUID(),
    medicationId: medication.id,
    doseAmount: elements.doseAmount.value.trim(),
    takenAt: takenAt.toISOString(),
    notes: elements.entryNotes.value.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const warnings = collectWarnings(entry, medication);
  if (warnings.length) {
    showWarningDialog(warnings, () => saveEntry(entry));
    return;
  }

  saveEntry(entry);
}

function saveEntry(entry) {
  const existingIndex = state.entries.findIndex((item) => item.id === entry.id);
  if (existingIndex >= 0) {
    state.entries.splice(existingIndex, 1, {
      ...state.entries[existingIndex],
      ...entry,
      updatedAt: new Date().toISOString(),
    });
  } else {
    state.entries.push(entry);
  }

  state.ui.lastNotificationMap[entry.medicationId] = null;
  resetDoseForm();
  renderAll();
}

function handleCustomMedicationSubmit(event) {
  event.preventDefault();
  state.medications.push({
    id: crypto.randomUUID(),
    name: elements.customName.value.trim(),
    doseLabel: elements.customDose.value.trim(),
    intervalHours: sanitizeNumber(elements.customInterval.value, 6),
    dailyMax: elements.customDailyMax.value
      ? sanitizeNumber(elements.customDailyMax.value, null)
      : null,
    notes: elements.customNotes.value.trim(),
    createdAt: new Date().toISOString(),
  });

  elements.customMedicationForm.reset();
  renderAll();
  setActiveTab("settings");
}

function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    medications: state.medications,
    entries: state.entries,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `recovery-med-tracker-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!Array.isArray(parsed.medications) || !Array.isArray(parsed.entries)) {
        throw new Error("Invalid import file.");
      }
      state.medications = parsed.medications;
      state.entries = parsed.entries;
      renderAll();
      resetDoseForm();
      setActiveTab("history");
    } catch (error) {
      window.alert(`Import failed: ${error.message}`);
    } finally {
      elements.importInput.value = "";
    }
  };
  reader.readAsText(file);
}

async function handleNotificationRequest() {
  if (!("Notification" in window)) {
    return;
  }
  const permission = await Notification.requestPermission();
  state.ui.notificationPermissionRequested = true;
  state.ui.notificationsEnabled = permission === "granted";
  renderNotificationState();
  saveState();
}

function collectWarnings(entry, medication) {
  const warnings = [];
  const entryTime = new Date(entry.takenAt).getTime();
  const lastEntry = getLastEntryForMedication(medication.id, entry.id);

  if (lastEntry) {
    const lastTime = new Date(lastEntry.takenAt).getTime();
    const nextAllowed = lastTime + medication.intervalHours * MS_PER_HOUR;
    if (entryTime < nextAllowed) {
      warnings.push(
        `${medication.name} was last logged at ${formatTimestamp(
          lastEntry.takenAt
        )}. Based on the current ${medication.intervalHours}-hour interval, the next allowed time is ${formatTimestamp(
          nextAllowed
        )}.`
      );
    }
  }

  if (medication.dailyMax) {
    const countForDay = getEntriesForMedicationWithinWindow(
      medication.id,
      entry.takenAt,
      MS_PER_DAY,
      entry.id
    ).length;
    if (countForDay + 1 > medication.dailyMax) {
      warnings.push(
        `${medication.name} would exceed the configured daily max of ${medication.dailyMax} logged doses in the last 24 hours.`
      );
    }
  }

  return warnings;
}

function showWarningDialog(warnings, onConfirm) {
  elements.warningMessage.innerHTML = "";
  warnings.forEach((warning) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = warning;
    elements.warningMessage.append(paragraph);
  });

  elements.warningDialog.showModal();

  const listener = () => {
    if (elements.warningDialog.returnValue === "confirm") {
      onConfirm();
    }
    elements.warningDialog.removeEventListener("close", listener);
  };

  elements.warningDialog.addEventListener("close", listener);
}

function populateFormForEdit(entry) {
  elements.entryId.value = entry.id;
  elements.medicationId.value = entry.medicationId;
  elements.doseAmount.value = entry.doseAmount;
  elements.takenAt.value = toDateTimeLocalValue(entry.takenAt);
  elements.entryNotes.value = entry.notes ?? "";
  elements.saveEntryButton.textContent = "Update dose";
}

function resetDoseForm() {
  elements.doseForm.reset();
  elements.entryId.value = "";
  elements.saveEntryButton.textContent = "Save dose";
  elements.takenAt.value = toDateTimeLocalValue(new Date());
  renderMedicationOptions();
}

function getMedicationSummaries() {
  return state.medications.map((medication) => {
    const lastEntry = getLastEntryForMedication(medication.id);
    const lastTakenAt = lastEntry ? new Date(lastEntry.takenAt).getTime() : null;
    const nextAllowedAt = lastTakenAt
      ? lastTakenAt + medication.intervalHours * MS_PER_HOUR
      : Date.now();
    return {
      medication,
      hasHistory: Boolean(lastEntry),
      lastTakenAt,
      nextAllowedAt,
      isAvailable: nextAllowedAt <= Date.now(),
      isAlternationCue:
        medication.name.includes("Tylenol") || medication.name.includes("Motrin"),
    };
  });
}

function getLastEntryForMedication(medicationId, excludedEntryId = null) {
  return getSortedEntries()
    .filter((entry) => entry.medicationId === medicationId && entry.id !== excludedEntryId)[0];
}

function getEntriesForMedicationWithinWindow(
  medicationId,
  referenceTime,
  windowMs,
  excludedEntryId = null
) {
  const reference = new Date(referenceTime).getTime();
  const windowStart = reference - windowMs;
  return state.entries.filter((entry) => {
    if (entry.medicationId !== medicationId || entry.id === excludedEntryId) {
      return false;
    }
    const entryTime = new Date(entry.takenAt).getTime();
    return entryTime >= windowStart && entryTime <= reference;
  });
}

function getSortedEntries() {
  return state.entries
    .slice()
    .sort((a, b) => new Date(b.takenAt) - new Date(a.takenAt));
}

function findMedication(medicationId) {
  return state.medications.find((medication) => medication.id === medicationId) ?? null;
}

function startCountdownTicker() {
  if (countdownTimer) {
    window.clearInterval(countdownTimer);
  }
  countdownTimer = window.setInterval(() => {
    renderNextMedicationCard();
    renderStatusCards();
    maybeSendNotifications();
  }, 30 * 1000);
}

function maybeSendNotifications() {
  if (!("Notification" in window)) {
    return;
  }
  if (!(state.ui.notificationsEnabled && Notification.permission === "granted")) {
    return;
  }

  getMedicationSummaries().forEach((summary) => {
    if (!(summary.hasHistory && summary.isAvailable)) {
      return;
    }
    const lastNotifiedAt = state.ui.lastNotificationMap[summary.medication.id];
    if (lastNotifiedAt && lastNotifiedAt >= summary.nextAllowedAt) {
      return;
    }
    new Notification("Medication now available", {
      body: `${summary.medication.name} is now allowed based on the interval saved in the app.`,
      tag: `med-${summary.medication.id}-${summary.nextAllowedAt}`,
    });
    state.ui.lastNotificationMap[summary.medication.id] = Date.now();
    saveState();
  });
}

function syncDoseFieldToMedication() {
  const medication = findMedication(elements.medicationId.value);
  if (!medication) {
    return;
  }

  if (!elements.entryId.value && !elements.doseAmount.value.trim()) {
    elements.doseAmount.value = medication.doseLabel;
  }
  if (!elements.takenAt.value) {
    elements.takenAt.value = toDateTimeLocalValue(new Date());
  }
}

function formatTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const differenceDays = Math.round((dateStart - todayStart) / MS_PER_DAY);

  let dayLabel = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  if (differenceDays === 0) {
    dayLabel = "Today";
  } else if (differenceDays === 1) {
    dayLabel = "Tomorrow";
  } else if (differenceDays === -1) {
    dayLabel = "Yesterday";
  }

  const timeLabel = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${dayLabel}, ${timeLabel}`;
}

function formatRelativeTime(timestamp) {
  const diff = timestamp - Date.now();
  if (diff <= 0) {
    return "available now";
  }
  return formatCountdown(diff);
}

function formatCountdown(ms) {
  if (ms <= 0) {
    return "now";
  }

  const totalMinutes = Math.ceil(ms / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours && minutes) {
    return `${hours}h ${minutes}m`;
  }
  if (hours) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

function sanitizeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toDateTimeLocalValue(value) {
  const date = value instanceof Date ? value : new Date(value);
  const timezoneOffset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - timezoneOffset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

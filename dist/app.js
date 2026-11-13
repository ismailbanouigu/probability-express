const $ = (selector, root = document) => root.querySelector(selector);
const connect = $("#polliConnect");
const appKey = window.PROBABILITY_EXPRESS_CONFIG?.appKey || "";

const MODELS = [
  { id: "typesafe/jev-1.14", name: "Jev", maker: "TYPESAFE", glyph: "JV" },
  { id: "microsoft/microsoft-decision-1", name: "Decision-1", maker: "MICROSOFT", glyph: "M1" },
  { id: "perplexity/pplx-decider-v1.2", name: "Decider", maker: "PERPLEXITY", glyph: "PD" },
  { id: "openai/gpt-6-luna-decisions", name: "Luna", maker: "OPENAI", glyph: "LU" }
];

const HAZARDS = [
  { code: "PX–17", icon: "⌁", kicker: "WEATHER / VISIBILITY", title: "Whiteout at Needle Pass", brief: "Snow has erased the western switch. The pressure gauge is stable, but the radio reports a slow freight somewhere ahead.", clues: ["SIGHT 14 M", "BRAKES WARM", "RADIO DELAY 8 S"], minutes: 7, damage: 22, options: {
    brake: { label: "Brake and listen", detail: "Stop before the switch and triangulate the freight by rail vibration.", odds: 78 },
    west: { label: "Take the west switch", detail: "Trust the last signal and clear the exposed ridge before ice builds.", odds: 56 },
    horn: { label: "Advance on horn", detail: "Move at walking speed while sounding the horn into the whiteout.", odds: 67 }
  }},
  { code: "PX–28", icon: "≋", kicker: "FLOOD / TRACTION", title: "Water over Blackglass Bridge", brief: "The river is rising across the sleepers. A maintenance spur climbs above the water but has not carried a train in eleven years.", clues: ["DEPTH +3 CM/MIN", "SPUR UNTESTED", "LOAD 61%"], minutes: 9, damage: 26, options: {
    cross: { label: "Cross before the crest", detail: "Hold speed and cross the main bridge before the next surge arrives.", odds: 62 },
    spur: { label: "Climb the old spur", detail: "Use the abandoned maintenance spur and accept unknown rail condition.", odds: 71 },
    wait: { label: "Wait for the gauge", detail: "Stop on high ground for one more river reading before committing.", odds: 76 }
  }},
  { code: "PX–41", icon: "⋈", kicker: "SIGNAL / IDENTITY", title: "Two green lights, one track", brief: "Both branch signals show clear, an impossible state. The dispatch checksum is valid on only one channel, but that channel is older.", clues: ["A: FRESH / BAD CRC", "B: OLD / GOOD CRC", "NO VISUAL CREW"], minutes: 6, damage: 20, options: {
    channelA: { label: "Follow fresh signal A", detail: "Prefer recency despite the failed checksum.", odds: 43 },
    channelB: { label: "Follow verified signal B", detail: "Prefer the older message with a valid checksum.", odds: 81 },
    manual: { label: "Stop and hand-throw", detail: "Send the conductor to inspect and move the switch manually.", odds: 73 }
  }},
  { code: "PX–53", icon: "△", kicker: "POWER / GRADE", title: "Voltage falling on Moth Hill", brief: "The electric grade steepens for four kilometres. Regeneration is offline and the rear battery car is reporting uneven heat.", clues: ["GRADE 4.8%", "CHARGE 31%", "REAR TEMP +12°"], minutes: 8, damage: 24, options: {
    sprint: { label: "Full-power sprint", detail: "Spend the remaining charge before heat forces a shutdown.", odds: 58 },
    detach: { label: "Detach battery car", detail: "Lose reserve capacity but remove the overheating load.", odds: 69 },
    reverse: { label: "Reverse to valley loop", detail: "Retreat to the diesel rescue loop at a large time cost.", odds: 84 }
  }},
  { code: "PX–66", icon: "◌", kicker: "WILDLIFE / UNKNOWN", title: "A warm shape in the tunnel", brief: "Thermal cameras show a large moving shape beyond the tunnel mouth. It reacts to light but not to the warning horn.", clues: ["RANGE 220 M", "MOVING SLOWLY", "NO TRACK CIRCUIT"], minutes: 5, damage: 18, options: {
    dim: { label: "Dim lights and coast", detail: "Reduce disturbance and enter at minimum speed.", odds: 74 },
    flare: { label: "Fire track flares", detail: "Use heat and light to move the shape away from the rails.", odds: 52 },
    reverse: { label: "Reverse to siding", detail: "Create distance and wait for the shape to leave.", odds: 79 }
  }}
];

const DEMO_VOTES = [
  { choice: "channelB", confidence: .82, probabilities: { channelA: .08, channelB: .82, manual: .10 } },
  { choice: "manual", confidence: .51, probabilities: { channelA: .12, channelB: .37, manual: .51 } },
  { choice: "channelB", confidence: .74, probabilities: { channelA: .11, channelB: .74, manual: .15 } },
  { choice: "channelB", confidence: .66, probabilities: { channelA: .16, channelB: .66, manual: .18 } }
];

let state = freshState();
function freshState() { return { round: 0, integrity: 100, minutes: 42, cleared: 0, busy: false, demoIndex: 0, scores: Object.fromEntries(MODELS.map((model) => [model.id, 0])) }; }

if (/^pk_[A-Za-z0-9_-]+$/.test(appKey)) connect.setAttribute("app-key", appKey);

function clean(value, fallback = "—", limit = 150) { return String(value ?? fallback).replace(/[<>]/g, "").slice(0, limit); }
function toast(message) { const el = $("#toast"); el.textContent = message; el.classList.add("show"); window.setTimeout(() => el.classList.remove("show"), 3200); }
function percent(value) { return `${Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100)}%`; }
function setBusy(value) { state.busy = value; $("#liveRound").disabled = value; $("#demoRound").disabled = value; $("#heroDemo").disabled = value; $("#liveRound").firstChild.textContent = value ? "MODELS ARE DECIDING... " : "RUN LIVE MODEL ROUND "; }

function renderModels(votes = [], hazard = currentHazard()) {
  const leaderId = Object.entries(state.scores).sort((a, b) => b[1] - a[1])[0]?.[0];
  $("#modelGrid").replaceChildren(...MODELS.map((model, index) => {
    const vote = votes[index]; const card = document.createElement("article"); card.className = "model-card"; card.dataset.state = state.busy ? "thinking" : (state.round && model.id === leaderId ? "leader" : "idle");
    const option = vote?.choice ? hazard?.options?.[vote.choice] : null;
    card.innerHTML = `<div class="model-top"><div class="model-id"><span class="model-avatar">${model.glyph}</span><div><strong>${model.name}</strong><small>${model.maker}</small></div></div><span class="model-status">${state.busy ? "THINKING" : vote ? "LOCKED" : "READY"}</span></div><p class="model-choice">${clean(option?.label, state.busy ? "Reading the signal…" : "No choice yet")}</p><div class="model-bottom"><span>CONF <b>${vote ? percent(vote.confidence) : "—"}</b></span><span>SCORE <b>${state.scores[model.id]}</b></span></div><div class="prob-bar"><i style="width:${vote ? percent(vote.confidence) : "0%"}"></i></div>`;
    return card;
  }));
  $("#leader").textContent = state.round ? MODELS.find((model) => model.id === leaderId)?.name || "—" : "—";
}

function currentHazard() { return HAZARDS[state.round % HAZARDS.length]; }
function showHazard(hazard) {
  $("#hazardCode").textContent = hazard.code; $("#hazardIcon").textContent = hazard.icon; $("#hazardKicker").textContent = hazard.kicker; $("#hazardTitle").textContent = hazard.title; $("#hazardBrief").textContent = hazard.brief;
  $("#clueList").replaceChildren(...hazard.clues.map((clue) => { const span = document.createElement("span"); span.textContent = clue; return span; }));
}

async function askModel(model, hazard) {
  const criteria = Object.fromEntries(Object.entries(hazard.options).map(([key, option]) => [key, `${option.label}: ${option.detail}`]));
  const response = await fetch("https://gen.pollinations.ai/alpha/decisions", { method: "POST", headers: { Authorization: `Bearer ${connect.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: model.id, state: { game: "Probability Express", objective: "Keep the night train intact while reaching the terminus on time.", train: { integrity_percent: state.integrity, minutes_to_terminus: state.minutes, signals_cleared: state.cleared }, hazard: { title: hazard.title, report: hazard.brief, clues: hazard.clues } }, questions: { maneuver: { type: "choice", instructions: "Choose the safest useful maneuver for the train. Return calibrated probabilities across every option.", criteria } } }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || payload?.message || `${model.name} failed (${response.status})`);
  const answer = payload?.answers?.maneuver || {}; const keys = Object.keys(hazard.options); const choice = keys.includes(answer.choice) ? answer.choice : keys[0];
  const probabilities = Object.fromEntries(keys.map((key) => [key, Number(answer.probabilities?.[key]) || (key === choice ? Number(answer.confidence) || 1 : 0)]));
  const total = Object.values(probabilities).reduce((sum, value) => sum + value, 0) || 1; Object.keys(probabilities).forEach((key) => { probabilities[key] /= total; });
  return { choice, probabilities, confidence: probabilities[choice] };
}

function consensusFor(votes, hazard) {
  const averages = Object.fromEntries(Object.keys(hazard.options).map((key) => [key, votes.reduce((sum, vote) => sum + (vote.probabilities[key] || 0), 0) / votes.length]));
  const choice = Object.entries(averages).sort((a, b) => b[1] - a[1])[0][0]; return { choice, confidence: averages[choice], probabilities: averages };
}
function secureRoll() { const sample = new Uint32Array(1); crypto.getRandomValues(sample); return (sample[0] % 100) + 1; }
function scoreVotes(votes, consensus, success) {
  votes.forEach((vote, index) => { const p = Math.max(0, Math.min(1, vote.probabilities[consensus.choice] || 0)); const target = success ? 1 : 0; const points = Math.round(100 * (1 - ((p - target) ** 2))); state.scores[MODELS[index].id] += points; });
}

function resolveRound(hazard, votes, roll) {
  const consensus = consensusFor(votes, hazard); const option = hazard.options[consensus.choice]; const success = roll <= option.odds; scoreVotes(votes, consensus, success);
  state.round += 1; state.minutes = Math.max(0, state.minutes - hazard.minutes); if (success) state.cleared += 1; else state.integrity = Math.max(0, state.integrity - hazard.damage);
  $("#consensusName").textContent = option.label; $("#consensusReason").textContent = `Crew average across all model probability maps. Success threshold: ${option.odds}%.`; $("#consensusMeter").style.width = percent(consensus.confidence); $("#consensusValue").textContent = percent(consensus.confidence);
  const outcome = $("#outcome"); outcome.dataset.tone = success ? "success" : "fail"; $("#outcomeTitle").textContent = success ? "Signal cleared" : "The fog answered no"; $("#outcomeText").textContent = `The crew chose “${option.label}.” Roll ${roll} vs ${option.odds}: ${success ? "safe passage" : `integrity −${hazard.damage}%`}.`;
  state.busy = false;
  $("#roundNumber").textContent = `${state.round} / 5`; $("#integrity").textContent = `${state.integrity}%`; $("#integrityBar").style.width = `${state.integrity}%`; $("#minutes").textContent = state.minutes; $("#cleared").textContent = state.cleared; renderModels(votes, hazard);
  if (state.integrity <= 0) toast("Run ended: the train needs recovery. Reset to try again."); else if (state.round >= 5) toast(`Run complete: ${state.cleared}/5 signals cleared with ${state.integrity}% integrity.`); else toast(success ? `Signal cleared on roll ${roll}.` : `Hazard hit on roll ${roll}. The crew continues.`);
}

async function playRound({ demo = false, trusted = false } = {}) {
  if (state.busy) return; if (!demo && !trusted) return; if (state.round >= 5 || state.integrity <= 0) { toast("Reset the run before starting another round."); return; }
  if (!demo && !connect.apiKey) { toast("Connect your Pollinations wallet to run the live model crew."); return; }
  const hazard = demo ? HAZARDS[2] : currentHazard(); showHazard(hazard); setBusy(true); renderModels();
  try {
    const votes = demo ? DEMO_VOTES : await Promise.all(MODELS.map((model) => askModel(model, hazard)));
    const roll = demo ? 47 : secureRoll(); resolveRound(hazard, votes, roll); if (demo) state.demoIndex += 1;
  } catch (error) { toast(clean(error.message, "The dispatch line failed. Try again.")); }
  finally { setBusy(false); }
}

function resetRun() {
  state = freshState(); $("#runNumber").textContent = String(Math.floor(Math.random() * 899) + 101); $("#roundNumber").textContent = "0 / 5"; $("#integrity").textContent = "100%"; $("#integrityBar").style.width = "100%"; $("#minutes").textContent = "42"; $("#cleared").textContent = "0"; $("#leader").textContent = "—"; $("#consensusName").textContent = "No maneuver yet"; $("#consensusReason").textContent = "Average probability across the available model crew."; $("#consensusMeter").style.width = "0%"; $("#consensusValue").textContent = "0%"; $("#outcome").dataset.tone = "idle"; $("#outcomeTitle").textContent = "Not resolved"; $("#outcomeText").textContent = "Consensus and the d100 roll will appear here."; showHazard({ code: "PX–00", icon: "⌁", kicker: "AWAITING DEPARTURE", title: "The platform is quiet.", brief: "Start a live round or run the zero-Pollen demonstration. The models—not the passenger—will choose the maneuver.", clues: ["NO ACTIVE HAZARD", "ODDS SEALED", "CREW READY"] }); renderModels(); toast("New run ready.");
}

$("#liveRound").addEventListener("click", (event) => playRound({ trusted: event.isTrusted }));
$("#demoRound").addEventListener("click", () => playRound({ demo: true }));
$("#heroDemo").addEventListener("click", () => { $("#game").scrollIntoView({ behavior: "smooth" }); playRound({ demo: true }); });
$("#resetRun").addEventListener("click", resetRun);
renderModels();

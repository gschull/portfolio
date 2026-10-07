const grid = document.querySelector("#project-grid");
const search = document.querySelector("#search");
const source = document.querySelector("#source");
const category = document.querySelector("#category");
const visibility = document.querySelector("#visibility");
const count = document.querySelector("#result-count");
const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });
let projects = [];

function render() {
  const query = search.value.trim().toLowerCase();
  const visible = projects.filter(project =>
    (source.value === "all" || project.source === source.value) &&
    (category.value === "all" || project.category === category.value) &&
    (visibility.value === "all" || project.visibility === visibility.value) &&
    [project.name, project.description, project.category, project.owner, ...project.tags].join(" ").toLowerCase().includes(query)
  );
  grid.replaceChildren();
  for (const project of visible) {
    const fragment = document.querySelector("#project-template").content.cloneNode(true);
    fragment.querySelector(".project-name").textContent = project.name;
    fragment.querySelector(".project-description").textContent = project.description;
    fragment.querySelector(".project-category").textContent = project.category;
    fragment.querySelector(".project-owner").textContent = project.source === "personal" ? "Personal" : project.owner;
    fragment.querySelector(".project-note").textContent = [project.note, project.archived ? "Archived repository." : "", project.fork ? "Fork of an upstream project." : ""].filter(Boolean).join(" ");
    const tags = fragment.querySelector(".project-tags");
    for (const tag of project.tags) {
      const item = document.createElement("li");
      item.textContent = tag;
      tags.append(item);
    }
    const link = fragment.querySelector(".project-link");
    if (project.visibility === "private-summary") {
      fragment.querySelector(".project-date").textContent = `Reviewed ${dateFormatter.format(new Date(project.reviewedAt))}`;
      const label = document.createElement("span");
      label.className = "private-label";
      label.textContent = "Private work";
      link.replaceWith(label);
    } else {
      fragment.querySelector(".project-date").textContent = `Pushed ${dateFormatter.format(new Date(project.pushedAt))}`;
      const url = new URL(project.url);
      if (url.origin !== "https://github.com") throw new Error("Project source must link to GitHub.");
      link.href = url.href;
    }
    grid.append(fragment);
  }
  count.textContent = `${visible.length} of ${projects.length} projects`;
  document.querySelector("#empty-state").hidden = visible.length !== 0;
}

async function initialize() {
  try {
    const response = await fetch("./data/projects.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`Repository snapshot returned HTTP ${response.status}.`);
    const snapshot = await response.json();
    if (!Array.isArray(snapshot.projects)) throw new Error("Repository snapshot has an invalid format.");
    projects = snapshot.projects;
    const privateCount = projects.filter(project => project.visibility === "private-summary").length;
    document.querySelector("#portfolio-stats").textContent = `${projects.length} contributed projects / ${projects.length - privateCount} public-source projects / ${privateCount} reviewed private-work summaries`;
    for (const name of [...new Set(projects.map(project => project.category))].sort()) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      category.append(option);
    }
    document.querySelector("#freshness").textContent = `Snapshot refreshed ${dateFormatter.format(new Date(snapshot.updatedAt))}`;
    render();
    search.addEventListener("input", render);
    source.addEventListener("change", render);
    category.addEventListener("change", render);
    visibility.addEventListener("change", render);
  } catch (error) {
    console.error("Portfolio could not load:", error);
    document.querySelector("#freshness").textContent = "Repository snapshot unavailable";
    const message = document.querySelector("#load-error");
    message.textContent = "Projects could not be loaded. Please reload the page or browse the linked GitHub profile.";
    message.hidden = false;
  }
}

initialize();

fetch('../data/catalog.json')

.then(r => r.json())

.then(data => {

const units = document.getElementById("units")

if(units){

 data.units.forEach(u => {

 units.innerHTML += `

 <div class="card">

 <h3>${u.name}</h3>

 <a href="unidad.html?u=${u.slug}">

 <button>Ver Unidad</button>

 </a>

 </div>

 `

 })

}

const lessons = document.getElementById("lessons")

if(lessons){

const params = new URLSearchParams(window.location.search)

const slug = params.get("u")

const unit = data.units.find(x => x.slug === slug)

 document.getElementById("title").innerText = unit.name

 unit.lessons.forEach(l => {

 lessons.innerHTML += `

 <div class="card">

 <h3>${l.title}</h3>

 <a href="../notebooks/${l.file}" download>

 <button>Descargar</button>

 </a>

 <a href="https://colab.research.google.com/github/USER/REPO/blob/main/notebooks/${l.file}">

 <button>Abrir en Colab</button>

 </a>

 </div>

 `

 })

}

})
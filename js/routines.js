// LiftEngine · creador y gestión de rutinas
'use strict';
window.openRoutineEditor = function(origName = '') {
    const isEdit = !!origName;
    const rName = isEdit ? origName : '';
    const exercises = isEdit && customRoutines[origName] ? customRoutines[origName] : [];

    let html = `
    <div class="modal-content-wrapper">
        <h2 style="margin-top:0">${isEdit ? 'Editar Rutina' : 'Crear Rutina'}</h2>
        <label>Nombre de la rutina</label>
        <input type="text" id="editRoutineName" value="${escapeHtml(rName)}" placeholder="Ej. Push, Pull, Pierna..." style="margin-bottom: 12px;" ${isEdit ? 'data-orig="'+escapeHtml(origName)+'"' : ''}>

        <label>Ejercicios</label>
        <div id="editRoutineExercises" style="max-height: 45vh; overflow-y: auto; padding-right: 5px; margin-bottom:10px;"></div>

        <button class="add-set" onclick="addRoutineExerciseRow()">+ Añadir Ejercicio</button>

        <div class="actions" style="margin-top:16px;">
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="saveRoutine()">Guardar</button>
        </div>
        ${isEdit ? `<div style="margin-top:10px;"><button class="btn btn-danger full" data-name="${escapeHtml(origName)}" onclick="deleteRoutine(this.dataset.name)">Eliminar Rutina</button></div>` : ''}
    </div>`;

    const modal = document.getElementById('modal');
    modal.innerHTML = html;
    
    if(exercises.length === 0) {
        addRoutineExerciseRow();
    } else {
        exercises.forEach(ex => addRoutineExerciseRow(ex));
    }

    document.getElementById('modalBackdrop').classList.add('show');
    document.body.classList.add('modal-open');
}

window.addRoutineExerciseRow = function(ex = null) {
    const name = ex ? ex.name : '';
    const sets = ex ? ex.sets : '';
    const reps = ex ? ex.reps : '';
    const rir = ex ? ex.rir : '';
    const rest = ex ? ex.rest : '';

    const div = document.createElement('div');
    div.className = 'routine-edit-row';
    div.innerHTML = `
        <div class="re-head">
            <input class="re-name" placeholder="Nombre del ejercicio" value="${escapeHtml(name)}" list="exerciseList">
            <button class="remove-set" aria-label="Quitar ejercicio" onclick="this.closest('.routine-edit-row').remove()"><svg class="ic" aria-hidden="true"><use href="#i-x"/></svg></button>
        </div>
        <div class="re-subgrid">
            <div><label>Series</label><input class="re-sets" type="number" value="${sets}"></div>
            <div><label>Reps</label><input class="re-reps" placeholder="8-12" value="${escapeHtml(reps)}"></div>
            <div><label>RIR</label><input class="re-rir" placeholder="1-2" value="${escapeHtml(rir)}"></div>
            <div><label>Descanso</label><input class="re-rest" placeholder="90 s" value="${escapeHtml(normalizeRestLabel(rest))}"></div>
        </div>
    `;
    document.getElementById('editRoutineExercises').appendChild(div);
}

window.saveRoutine = async function() {
    const nameInput = document.getElementById('editRoutineName');
    const newName = nameInput.value.trim();
    const origName = nameInput.getAttribute('data-orig');
    const affectedDates=[];

    if(!newName) { toast('Ingresa un nombre para la rutina'); return; }

    if(origName && origName !== newName) {
        if(customRoutines[newName] && !(await appConfirm('Ya existe una rutina llamada "'+newName+'". ¿Quieres reemplazarla?',{title:'Rutina existente',confirmText:'Reemplazar',danger:true}))) return;
        delete customRoutines[origName];
        Object.keys(categories).forEach(d=>{ if(categories[d]===origName){ categories[d]=newName; affectedDates.push(d); } });
        if(train&&train.routine===origName){ train.routine=newName; saveTrain(); }
    } else if(!origName && customRoutines[newName]) {
        if(!(await appConfirm('Ya existe una rutina llamada "'+newName+'". ¿Quieres reemplazarla?',{title:'Rutina existente',confirmText:'Reemplazar',danger:true}))) return;
    }

    const rows = document.querySelectorAll('.routine-edit-row');
    const newExercises = [];
    rows.forEach(r => {
        const eName = normalizeName(r.querySelector('.re-name').value.trim());
        const eSets = parseInt(r.querySelector('.re-sets').value) || 0;
        const eReps = r.querySelector('.re-reps').value.trim();
        const eRir = r.querySelector('.re-rir').value.trim();
        const eRest = r.querySelector('.re-rest').value.trim();

        if(eName && eSets > 0) {
            newExercises.push({ name: eName, sets: eSets, reps: eReps, rir: eRir, rest: normalizeRestLabel(eRest || '90 s') });
        }
    });

    if(newExercises.length === 0) { toast('Agrega al menos un ejercicio con series válidas'); return; }

    customRoutines[newName] = newExercises;
    saveToFirebase({days:affectedDates,settings:true});
    updateCategorySelect();
    renderRoutines();
    closeModal();
    toast('Rutina guardada');
}

window.deleteRoutine = async function(name) {
    if(!(await appConfirm(`¿Estás seguro de eliminar la rutina "${name}"?`,{title:'Eliminar rutina',confirmText:'Eliminar',danger:true}))) return;
    delete customRoutines[name];
    saveToFirebase({settings:true});
    updateCategorySelect();
    renderRoutines();
    closeModal();
    toast('Rutina eliminada');
}

function renderRoutines(){
  document.getElementById('routineContent').innerHTML=Object.entries(customRoutines).map(([name,rows])=>{
    const totalSets=rows.reduce((sum,r)=>sum+(parseInt(r.sets,10)||0),0);
    return `<details>
        <summary>
            <span class="routine-summary-copy"><b>${escapeHtml(name)}</b><small>${rows.length} ejercicio${rows.length===1?'':'s'} · ${totalSets} series planificadas</small></span>
            <button class="btn-edit-sm" data-name="${escapeHtml(name)}" onclick="event.preventDefault(); event.stopPropagation(); openRoutineEditor(this.dataset.name)">${ic('edit')} Editar</button>
        </summary>
        <div class="routine-content">
            <table>
                <thead><tr><th>Ejercicio</th><th>Series</th><th>Reps</th><th>RIR</th><th>Descanso</th></tr></thead>
                <tbody>${rows.map(r=>`<tr><td>${escapeHtml(r.name)}</td><td>${r.sets}</td><td>${escapeHtml(r.reps)}</td><td>${escapeHtml(r.rir)}</td><td>${escapeHtml(normalizeRestLabel(r.rest))}</td></tr>`).join('')}</tbody>
            </table>
        </div>
    </details>`;
  }).join('') || '<div class="empty"><b>Aún no tienes rutinas</b><span>Crea tu primera rutina para iniciar entrenamientos guiados.</span><button class="btn btn-primary empty-action" type="button" onclick="openRoutineEditor()">Crear primera rutina</button></div>';
}



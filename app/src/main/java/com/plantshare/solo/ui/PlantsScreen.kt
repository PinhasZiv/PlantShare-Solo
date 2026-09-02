package com.plantshare.solo.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.plantshare.solo.ServiceLocator
import com.plantshare.solo.data.Due
import com.plantshare.solo.data.Plant
import com.plantshare.solo.data.PlantState
import com.plantshare.solo.data.PlantStatus
import com.plantshare.solo.ui.theme.DoneColor
import com.plantshare.solo.ui.theme.DoneContainer
import com.plantshare.solo.ui.theme.OverdueColor
import com.plantshare.solo.ui.theme.OverdueContainer
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlantsScreen(onOpenSettings: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val store = remember { ServiceLocator.plantStore(context) }
    val plants by store.plants.collectAsState()
    val snackbar = remember { SnackbarHostState() }

    var showAdd by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<Plant?>(null) }

    // Recomputed whenever the screen comes back to the foreground, so the list
    // rolls over correctly if the app was left open across midnight.
    val today = rememberToday()

    val statuses = plants.map { Due.statusOf(it, today) }
    val needsWater = statuses.filter { it.needsWater }
        .sortedWith(compareByDescending<PlantStatus> { it.daysLate }.thenBy { it.plant.name })
    val doneToday = statuses.filter { it.state == PlantState.WATERED_TODAY }
    val upcoming = statuses.filter { it.state == PlantState.UPCOMING }
        .sortedBy { it.plant.nextDueEpochDay }

    fun water(status: PlantStatus) {
        val previousDue = status.plant.nextDueEpochDay
        val previousWatered = status.plant.lastWateredEpochDay
        store.markWatered(status.plant.id)
        scope.launch {
            val result = snackbar.showSnackbar(
                message = "${status.plant.name} watered",
                actionLabel = "Undo",
            )
            if (result == SnackbarResult.ActionPerformed) {
                store.undoWatering(status.plant.id, previousDue, previousWatered)
            }
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                title = { Text("Plants") },
                actions = {
                    IconButton(onClick = onOpenSettings) {
                        Icon(Icons.Filled.Settings, contentDescription = "Settings")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showAdd = true }) {
                Icon(Icons.Filled.Add, contentDescription = "Add a plant")
            }
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp),
            contentPadding = PaddingValues(bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (plants.isEmpty()) {
                item {
                    Text(
                        "Nothing here yet. Add a plant with the name you actually call " +
                            "it and how many days it can go between waterings.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 12.dp),
                    )
                }
            }

            if (needsWater.isNotEmpty()) {
                item { SectionHeader("Needs water") }
                items(needsWater, key = { it.plant.id }) { status ->
                    PlantRow(status, today, onWater = { water(status) }) { editing = status.plant }
                }
            }

            if (doneToday.isNotEmpty()) {
                item { SectionHeader("Done today") }
                items(doneToday, key = { it.plant.id }) { status ->
                    PlantRow(status, today, onWater = null) { editing = status.plant }
                }
            }

            if (upcoming.isNotEmpty()) {
                item { SectionHeader("Coming up") }
                items(upcoming, key = { it.plant.id }) { status ->
                    PlantRow(status, today, onWater = null) { editing = status.plant }
                }
            }
        }
    }

    if (showAdd) {
        PlantEditorDialog(
            existing = null,
            onDismiss = { showAdd = false },
            onSave = { name, period, dueToday ->
                showAdd = false
                store.add(name, period, dueToday)
            },
            onDelete = null,
        )
    }

    editing?.let { plant ->
        PlantEditorDialog(
            existing = plant,
            onDismiss = { editing = null },
            onSave = { name, period, _ ->
                editing = null
                store.edit(plant.id, name, period)
            },
            onDelete = {
                editing = null
                store.delete(plant.id)
            },
        )
    }
}

@Composable
private fun SectionHeader(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(top = 18.dp, bottom = 2.dp),
    )
}

@Composable
private fun PlantRow(
    status: PlantStatus,
    today: Long,
    onWater: (() -> Unit)?,
    onEdit: () -> Unit,
) {
    val overdue = status.state == PlantState.LATE
    val done = status.state == PlantState.WATERED_TODAY

    val container = when {
        overdue -> OverdueContainer
        done -> DoneContainer
        else -> MaterialTheme.colorScheme.surface
    }
    val accent = when {
        overdue -> OverdueColor
        done -> DoneColor
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(container, RoundedCornerShape(14.dp))
            .clickable(onClick = onEdit)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(status.plant.name, style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(2.dp))
            Text(
                Due.describe(status, today),
                style = MaterialTheme.typography.labelMedium,
                color = accent,
            )
        }

        when {
            onWater != null -> Button(
                onClick = onWater,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (overdue) OverdueColor else MaterialTheme.colorScheme.primary,
                    contentColor = Color.White,
                ),
            ) { Text("Water") }

            done -> Icon(Icons.Filled.Check, contentDescription = "Watered", tint = DoneColor)
        }
    }
}

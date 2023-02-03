const solver = require('javascript-lp-solver')
const activityCode = require('./../activity_code')
const extension = require('./../extension')
const lib = require('./../lib')

function Assign(competition, round, assignmentSets, scorers, override) {
  var groups = lib.groupsForRoundCode(competition, round)
  var activityIds = groups.map((group) => group.wcif.id)

  if (competition.persons.map((person) => person.assignments).flat()
          .some((assignment) => activityIds.includes(assignment.activityId))) {
    if (!override) {
      return {
        round: round,
        groups: groups,
        warnings: ['Groups are already saved. Not overwriting unless overwrite=true is added.'],
        assignments: {},
      }
    } else {
      competition.persons.forEach((person) => {
        person.assignments = person.assignments.filter(
            (assignment) => !activityIds.includes(assignment.activityId))
      })
    }
  }

  var personIds = lib.getWcifRound(competition, round)
                     .results.map((res) => res.personId)

  var people =
      competition.persons.filter((person) => personIds.includes(person.registrantId))
    .sort((p1, p2) => {
      var pb1 = lib.personalBest(p1, round)
      var pb2 = lib.personalBest(p2, round)
      if (pb1 === null) {
        return 1
      }
      if (pb2 === null) {
        return -1
      }
      return pb1.value - pb2.value
    })

  var assignmentsByPerson = {}
  var assignmentsByGroup = {}
  groups.forEach((group) => {
    assignmentsByGroup[group.wcif.id] = []

    var ext = extension.getExtension(group, 'ActivityConfig', 'groupifier')
    ext.featuredUserIds = []
  })
  warnings = []
  assignmentSets.forEach((set) => {
    var eligibleGroups = groups.filter((group) => set.groupFilter({Group: group}))
    var eligiblePeople = people.filter((person) => set.personFilter({Person: person}))
    if (eligibleGroups.length == 0) {
      warnings.push({
        type: 'NO_ELIGIBLE_GROUPS',
        category: set.name,
      })
      return
    }
    var queue = []
    var currentByPerson = {}
    var currentByGroup = {}
    // wcaUserId -> group id
    var preAssignedByPerson = {}
    // group id -> count
    var preAssignedByGroup = {}
    eligibleGroups.forEach((group) => {
      currentByGroup[group.wcif.id] = []
      preAssignedByGroup[group.wcif.id] = 0
    })
    eligiblePeople.forEach((person) => {
      if (person.wcaUserId in assignmentsByPerson) {
        var assignment = assignmentsByPerson[person.wcaUserId]
        var group = assignment.group
        if (group.wcif.id in currentByGroup) {
          queue.push({person: person, idx: queue.length})
          preAssignedByPerson[person.wcaUserId] = group.wcif.id
          preAssignedByGroup[group.wcif.id] += 1
        } else {
          warnings.push({
            type: 'ALREADY_ASSIGNED',
            set: set.name,
            person: person,
            group: group.wcif.id,
          })
        }
      } else {
        queue.push({person: person, idx: queue.length})
      }
    })
    var totalToAssign = queue.length
    while (queue.length) {
      // Don't assign any more to groups with enough people pre-assigned.
      var groupsToUse = eligibleGroups.filter((group) => currentByGroup[group.wcif.id].length + preAssignedByGroup[group.wcif.id] < totalToAssign / eligibleGroups.length)
      var model = {
        optimize: 'score',
        opType: 'max',
        constraints: {},
        variables: {},
        ints: {},
      }
      queue.slice(0, 100).forEach((queueItem) => {
        var personKey = queueItem.person.wcaUserId.toString()
        model.constraints[personKey] = {min: 0, max: 1}
        var scores = {}
        var total = 0
        groupsToUse.forEach((group) => {
          if (personKey in preAssignedByPerson && preAssignedByPerson[personKey] != group.wcif.id) {
            return
          }
          var newScore = 0
          scorers.forEach((scorer) => {
            newScore += scorer.getScore(queueItem.person, group, assignmentsByGroup[group.wcif.id].map((assignment) => assignment.person).concat(currentByGroup[group.wcif.id]))
          })
          total += newScore
          scores[group.wcif.id] = newScore
        })
        groupsToUse.forEach((group) => {
          if (!(group.wcif.id in scores)) {
            return
          }
          // Normalize all of the scores so that the average score is -idx.
          var adjustedScore = scores[group.wcif.id] - total / groupsToUse.length - queueItem.idx
          var groupKey = group.wcif.id
          var key = personKey + '-' + groupKey
          model.variables[key] = {
            score: adjustedScore,
            totalAssigned: 1,
          }
          model.variables[key][personKey] = 1
          model.variables[key][groupKey] = 1
          model.variables[key][key] = 1
          model.constraints[key] = {min: 0, max: 1}
          model.ints[key] = 1
        })
      })
      groupsToUse.forEach((group) => {
        model.constraints[group.wcif.id] = {min: 0, max: 1}
      })
      var numToAssign = Math.min(queue.length, groupsToUse.length)
      model.constraints.totalAssigned = {equal: numToAssign}
      var solution = solver.Solve(model)
      var newlyAssigned = []
      var indicesToErase = []
      queue.forEach((queueItem, idx) => {
        groupsToUse.forEach((group) => {
          var key = queueItem.person.wcaUserId.toString() + '-' + group.wcif.id
          if (key in solution && solution[key] == 1) {
            newlyAssigned.push({person: queueItem.person, group: group})
            indicesToErase.push(idx)
            if (set.featured) {
              var ext = extension.getExtension(group.wcif, 'ActivityConfig', 'groupifier')
              ext.featuredUserIds.append(queueItem.person.wcaUserId)
            }
          }
        })
      })
      queue = queue.filter((item, idx) => !indicesToErase.includes(idx))
      newlyAssigned.forEach((assn) => {
        currentByPerson[assn.person.wcaUserId] = assn.group
        currentByGroup[assn.group.wcif.id].push(assn.person)
        if (assn.person.wcaUserId in preAssignedByPerson) {
          delete preAssignedByPerson[assn.person.wcaUserId]
          preAssignedByGroup[assn.group.wcif.id] -= 1
        }
      })
    }
    for (const personId in currentByPerson) {
      assignmentsByPerson[personId] = {group: currentByPerson[personId], set: set.name}
    }
    for (const groupId in currentByGroup) {
      currentByGroup[groupId].forEach((person) => {
        if (!assignmentsByGroup[groupId].some((assignment) => assignment.person.wcaUserId == person.wcaUserId)) {
          assignmentsByGroup[groupId].push({person: person, set: set.name})
        }
      })
    }
  })
  for (const groupId in assignmentsByGroup) {
    assignmentsByGroup[groupId].sort(
        (a1, a2) => lib.personalBest(a1.person, round) < lib.personalBest(a2.person, round) ? -1 : 1)
  }
  competition.persons.forEach((person) => {
    if (person.wcaUserId in assignmentsByPerson) {
      person.assignments.push({
        activityId: assignmentsByPerson[person.wcaUserId].group.wcif.id,
        assignmentCode: "competitor",
      })
    }
  })
  return {
    round: round,
    groups: groups,
    assignments: assignmentsByGroup,
    warnings: warnings,
  }
}

class AssignmentSet {
  constructor(name, personFilter, groupFilter, featured) {
    this.name = name
    this.personFilter = personFilter
    this.groupFilter = groupFilter
    this.featured = featured
  }
}

module.exports = {
  Assign: Assign,
  AssignmentSet: AssignmentSet,
}

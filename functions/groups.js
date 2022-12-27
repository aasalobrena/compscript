const { DateTime } = require('luxon')

const activityCode = require('./../activity_code')
const assign = require('./../groups/assign')
const scorers = require('./../groups/scorers')
const lib = require('./../lib')

const AssignGroups = {
  name: 'AssignGroups',
  args: [
    {
      name: 'round',
      type: 'Activity',
    },
    {
      name: 'assignmentSets',
      type: 'Array<AssignmentSet>',
    },
    {
      name: 'scorers',
      type: 'Array<AssignmentScorer>',
      defaultValue: [],
    },
    {
      name: 'overwrite',
      type: 'Boolean',
      defaultValue: false,
    },
  ],
  outputType: 'GroupAssignmentResult',
  usesContext: true,
  mutations: ['persons'],
  implementation: (ctx, round, assignmentSets, scorers, overwrite) => {
    return assign.Assign(ctx.competition, round, assignmentSets, scorers, overwrite)
  }
}

const AssignmentSet = {
  name: 'AssignmentSet',
  args: [
    {
      name: 'name',
      type: 'String',
    },
    {
      name: 'personFilter',
      type: 'Boolean(Person)',
      lazy: true,
    },
    {
      name: 'groupFilter',
      type: 'Boolean(Activity)',
      lazy: true,
    },
  ],
  outputType: 'AssignmentSet',
  implementation: (name, personFilter, groupFilter) => {
    return new assign.AssignmentSet(name, personFilter, groupFilter)
  }
}

const ByMatchingValue = {
  name: 'ByMatchingValue',
  genericParams: ['T'],
  args: [
    {
      name: 'value',
      type: '$T(Person)',
      lazy: true,
    },
    {
      name: 'score',
      type: 'Number',
    },
  ],
  outputType: 'AssignmentScorer',
  implementation: (value, score) => {
    return new scorers.ByMatchingValue(value, score)
  }
}

const ByFilters = {
  name: 'ByFilters',
  args: [
    {
      name: 'personFilter',
      type: 'Boolean(Person)',
      lazy: true,
    },
    {
      name: 'groupFilter',
      type: 'Boolean(Activity)',
      lazy: true,
    },
    {
      name: 'score',
      type: 'Number',
    },
  ],
  outputType: 'AssignmentScorer',
  implementation: (personFilter, groupFilter, score) => {
    return new scorers.ByMatchingValue(personFilter, groupFilter, score)
  }
}

const GroupNumber = {
  name: 'GroupNumber',
  args: [],
  outputType: 'Number(Activity)',
  implementation: (activity) => {
    if (!activity.groupName) {
      return -1
    }
    return +activity.groupName.match(/\d+/g)[0]
  }
}

const Stage = {
  name: 'Stage',
  args: [],
  outputType: 'String(Activity)',
  implementation: (activity) => {
    if (!activity.groupName) {
      return ""
    }
    return activity.groupName.match(/[a-zA-Z]+/g)[0]
  }
}

const AssignedGroup = {
  name: 'AssignedGroup',
  args: [
    {
      name: 'event',
      type: 'Activity',
    },
  ],
  outputType: 'Activity(Person)',
  usesContext: true,
  implementation: (ctx, evt, person) => {
    var matching = person.assignments.map((assignment) => {
      if (assignment.assignmentCode != "competitor") {
        return null
      }
      var activity = lib.activityById(ctx.competition, assignment.activityId)
      if (activity === null) {
        return null
      }
      return activityCode.parse(activity.activityCode)
    }).filter((x) => x !== null)
    if (!matching.length) {
      return null
    }
    return matching[0]
  }
}

const GroupName = {
  name: 'GroupName',
  args: [
    {
      name: 'group',
      type: 'Activity',
    },
  ],
  outputType: 'String',
  implementation: (group) => {
    if (group === null) {
      return ''
    }
    return group.groupName
  }
}

const StartTime = {
  name: 'StartTime',
  args: [
    {
      name: 'group',
      type: 'Activity',
    },
  ],
  outputType: 'DateTime',
  usesContext: true,
  implementation: (ctx, group) => {
    if (group === null) {
      return null
    }
    var activity = lib.activityByCode(ctx.competition, group)
    if (activity === null) {
      return null
    }
    return DateTime.fromISO(activity.startTime).setZone(ctx.competition.schedule.venues[0].timezone)
  }
}

module.exports = {
  functions: [AssignGroups, AssignmentSet, ByMatchingValue, ByFilters,
              GroupNumber, Stage, AssignedGroup,
              GroupName, StartTime],
}

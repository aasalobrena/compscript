const { DateTime } = require('luxon')

const attemptResult = require('./attempt_result')
const groupLib = require('./group')

function getWcifEvent(competition, activity) {
  return competition.events.filter((evt) => evt.id == activity.eventId)[0]
}

function getWcifRound(competition, activity) {
  return getWcifEvent(competition, activity).rounds.filter((rd) => rd.id == activity.id())[0]
}

function personalBest(person, evt, type='default') {
  const eventId = evt.eventId
  if (type == 'default') {
    type = ['333bf', '444bf', '555bf', '333mbf'].includes(eventId) ? 'single' : 'average'
  }

  var matching = person.personalBests.filter((best) => best.eventId === eventId && best.type === type)
  if (matching.length == 0) {
    return null
  } else {
    return new attemptResult.AttemptResult(matching[0].best, eventId)
  }
}

function miscActivityForId(competition, activityId) {
  var matching = competition.schedule.venues.map((venue) => venue.rooms).flat()
    .map((room) => room.activities.map((activity) => new groupLib.Group(activity, room, competition))).flat()
    .filter((activity) => activity.wcif.id == activityId)
  if (matching.length) {
    return matching[0]
  }
  return null
}

function allActivitiesForRoundId(competition, roundId) {
  return competition.schedule.venues.map((venue) => venue.rooms).flat()
    .map((room) => room.activities
                       .map((activity) => activity.childActivities).flat()
                       .map((activity) => new groupLib.Group(activity, room, competition))).flat()
    .filter(activity => activity.activityCode.isActivity() && activity.activityCode.group(null).id() === roundId)
}

function allGroups(competition) {
  return competition.schedule.venues.map((venue) => venue.rooms).flat()
    .map((room) => {
      return room.activities
               .map((activity) => activity.childActivities).flat()
               .map((activity) => new groupLib.Group(activity, room, competition))
    }).flat()
}

function groupForActivityId(competition, activityId) {
  var matching = competition.schedule.venues.map((venue) => venue.rooms).flat()
     .map((room) => {
       return room.activities
                .map((activity) => [activity, ...activity.childActivities]).flat()
                .filter((activity) => activity.id == activityId)
                .map((activity) => [activity, room])
     }).flat()
  if (matching.length) {
    return new groupLib.Group(matching[0][0], matching[0][1], competition)
  }
  return null
}

function groupsForRoundCode(competition, roundCode) {
  return allGroups(competition).filter((group) => roundCode.contains(group.activityCode))
}

function startTime(group, competition) {
  return DateTime.fromISO(group.wcif.startTime).setZone(competition.schedule.venues[0].timezone)
}

function endTime(group, competition) {
  return DateTime.fromISO(group.wcif.endTime).setZone(competition.schedule.venues[0].timezone)
}

module.exports = {
  getWcifEvent: getWcifEvent,
  getWcifRound: getWcifRound,
  personalBest: personalBest,
  allGroups: allGroups,
  allActivitiesForRoundId: allActivitiesForRoundId,
  groupForActivityId: groupForActivityId,
  groupsForRoundCode: groupsForRoundCode,
  startTime: startTime,
  endTime: endTime,
  miscActivityForId: miscActivityForId,
}

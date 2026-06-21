import {
  getTeamSize,
  isEvilRole,
  type AvalonGameState,
} from '@game-lobby/game-engine';
import { QuestTrack } from './QuestTrack';
import { RoleBriefing } from './RoleBriefing';
import { TeamProposePanel } from './TeamProposePanel';
import { TeamVotePanel } from './TeamVotePanel';
import { MissionPanel } from './MissionPanel';
import { MissionRevealBanner } from './MissionRevealBanner';
import { LadyOfLakePanel } from './LadyOfLakePanel';
import { AssassinationPanel } from './AssassinationPanel';
import { EvilChatPanel } from './EvilChatPanel';
import { GameEndScreen } from './GameEndScreen';

interface Props {
  state: AvalonGameState;
  myMemberId: string | null;
  isSpectator: boolean;
  onProposeTeam: (memberIds: string[]) => void;
  onTeamVote: (approve: boolean) => void;
  onMissionCard: (success: boolean) => void;
  onContinue: () => void;
  onLadyPick: (targetId: string) => void;
  onAssassinate: (targetId: string) => void;
  onEvilChat: (text: string) => void;
}

export function AvalonGame({
  state,
  myMemberId,
  isSpectator,
  onProposeTeam,
  onTeamVote,
  onMissionCard,
  onContinue,
  onLadyPick,
  onAssassinate,
  onEvilChat,
}: Props) {
  const leader = state.players[state.leaderIndex]!;
  const me = state.players.find((p) => p.id === myMemberId);
  const myRole = state.viewerInfo?.myRole ?? (me?.role !== 'unknown' ? me?.role : undefined);
  const teamSize = getTeamSize(state.players.length, state.quest);
  const canEvilChat =
    !isSpectator &&
    myRole &&
    isEvilRole(myRole) &&
    myRole !== 'oberon' &&
    state.phase !== 'ended';

  if (state.phase === 'ended') {
    return <GameEndScreen state={state} />;
  }

  return (
    <div className="ww-game-layout">
      <div className="ww-main-column">
        <div className="card" style={{ marginBottom: '1rem' }}>
          <p style={{ margin: 0 }}>{state.message}</p>
          {state.rejectStreak > 0 && (
            <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              连续否决 {state.rejectStreak} / 5
            </p>
          )}
        </div>

        <QuestTrack
          quest={state.quest}
          successCount={state.successCount}
          failCount={state.failCount}
          questHistory={state.questHistory}
          teamSize={teamSize}
        />

        {!isSpectator && <RoleBriefing viewerInfo={state.viewerInfo} />}

        {state.phase === 'team_propose' && (
          <TeamProposePanel
            players={state.players}
            myMemberId={myMemberId}
            leaderId={leader.id}
            requiredSize={teamSize}
            onPropose={onProposeTeam}
          />
        )}

        {state.phase === 'team_vote' && (
          <TeamVotePanel
            players={state.players}
            myMemberId={myMemberId}
            leaderId={leader.id}
            proposedTeam={state.proposedTeam}
            teamVotes={state.teamVotes}
            hasVoted={myMemberId != null && state.teamVotes[myMemberId] !== undefined}
            onVote={onTeamVote}
          />
        )}

        {state.phase === 'mission_play' && (
          <MissionPanel
            isOnTeam={myMemberId != null && state.proposedTeam.includes(myMemberId)}
            hasVoted={myMemberId != null && state.missionVotes[myMemberId] !== undefined}
            isGood={!myRole || !isEvilRole(myRole)}
            onPlay={onMissionCard}
          />
        )}

        {state.phase === 'mission_reveal' && (
          <MissionRevealBanner
            failCount={state.lastMissionFailCount ?? 0}
            onContinue={onContinue}
          />
        )}

        {state.phase === 'lady_pick' && state.ladyHolderId && (
          <LadyOfLakePanel
            players={state.players}
            myMemberId={myMemberId}
            leaderId={leader.id}
            holderId={state.ladyHolderId}
            usedOn={state.ladyUsedOn}
            onPick={onLadyPick}
          />
        )}

        {state.phase === 'assassination' && (
          <AssassinationPanel
            players={state.players}
            myMemberId={myMemberId}
            leaderId={leader.id}
            isAssassin={myRole === 'assassin'}
            onAssassinate={onAssassinate}
          />
        )}
      </div>

      {(canEvilChat || state.evilChats.length > 0) && (
        <div className="ww-side-column">
          <EvilChatPanel
            messages={state.evilChats}
            canChat={!!canEvilChat}
            onChat={onEvilChat}
          />
        </div>
      )}
    </div>
  );
}

import React from 'react'
import './Yahtzee.css'
import * as api from './api'
import config from './config.js'

class Yahtzee extends React.Component {
  constructor(props) {
    super(props)
    this.loadGame = this.loadGame.bind(this)
    this.offerJoin = this.offerJoin.bind(this)
    this.handleRoll = this.handleRoll.bind(this)
    this.handleLock = this.handleLock.bind(this)
    this.handleScore = this.handleScore.bind(this)
    this.handleSuggestionRefresh = this.handleSuggestionRefresh.bind(this)
    this.state = {
      isLoaded: false
    }
  }

  render() {
    if (!this.state.isLoaded) {
      return <p>Loading game <strong>{this.props.game}</strong>... {this.state.error}</p>
    }

    const myTurn = this.state.Players.length > 0 && this.state.Players[this.state.CurrentPlayer].User === this.props.player

    return (
      <div id={this.props.game} className="yahtzee">
        <Dices
          dices={this.state.Dices}
          active={myTurn && this.state.RollCount > 0 && this.state.RollCount < 3}
          onLock={this.handleLock} />
        <Controller
          rollCount={this.state.RollCount}
          active={myTurn && this.state.RollCount < 3 && this.state.Round < 13}
          onRoll={this.handleRoll} />
        <Scores
          players={this.state.Players}
          suggestions={this.state.suggestions || {}}
          currentPlayer={this.state.CurrentPlayer}
          round={this.state.Round}
          active={myTurn && this.state.RollCount > 0}
          onScore={this.handleScore} />
      </div>
    )
  }

  componentDidMount() {
    this.loadGame()
  }

  offerJoin() {
    const gameNotStartedYet =
      this.state.RollCount === 0 &&
      this.state.CurrentPlayer === 0 &&
      this.state.Round === 0
    const alreadyJoined = this.state.Players.map((p) => p.User).includes(this.props.player)

    if (gameNotStartedYet && !alreadyJoined) {
      if (window.confirm("Game hasn't started yet! Do you want to join?")) {
        api.join(this.props.game, this.props.player)
          .then((res) => this.setState(res))
      }
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.game !== this.props.game) {
      this.loadGame()
    }
  }

  loadGame() {
    api.load(this.props.game, this.props.player)
      .then((res) => {
        if (res.isLoaded) {
          this.setState(res)
          this.handleSuggestionRefresh(res.Dices)
          this.offerJoin()
        }
      })
      .then((__) => {
        const ws = new WebSocket(config.baseUri.ws + '/' + this.props.game + '/ws')

        ws.onmessage = (e) => {
          this.setState(JSON.parse(e.data))
        }
      })
  }

  handleRoll() {
    api.roll(this.props.game, this.props.player)
      .then((res) => {
        this.setState(res)
        this.handleSuggestionRefresh(res.Dices)
      })
  }

  handleSuggestionRefresh(dices) {
    if (this.state.RollCount === 0) {
      this.setState({suggestions: {}})
      return
    }

    api.suggestions(this.props.player, dices)
      .then((res) => this.setState({suggestions: res}))
  }

  handleScore(category) {
    api.score(this.props.game, this.props.player, category)
      .then((res) => {
        this.setState(res)
        this.handleSuggestionRefresh(res.Dices)
      })
  }

  handleLock(idx) {
    api.lock(this.props.game, this.props.player, idx)
      .then((res) => this.setState(res))
  }
}

function Dices(props) {
  return (
    <div className="dices">
      {props.dices.map((d, i) => {
        return <Dice
          index={i}
          key={i}
          value={d.Value}
          locked={d.Locked}
          active={props.active}
          onLock={props.onLock} />
      })}
    </div>
  );
}

class Dice extends React.Component {
  constructor(props) {
    super(props)
    this.handleClick = this.handleClick.bind(this)
  }

  handleClick() {
    if (this.props.active) {
      this.props.onLock(this.props.index)
    }
  }

  render() {
    let className = "dice face-" + this.props.value
    if (this.props.locked) {
      className += " locked"
    }
    if (this.props.active) {
      className += " actionable"
    }

    return <div className={className} onClick={this.handleClick} />
  }
}

function Controller(props) {
  const className = "roll counter roll-" + props.rollCount

  return (
    <div className="controller">
      <div className={className}><div /><div /><div /></div>
      <RollButton {...props} />
    </div>
  )
}

class RollButton extends React.Component {
  render() {
    let className = "roll button"
    if (!this.props.active) {
      className += " disabled"
    }

    return <div className={className} onClick={this.props.active ? this.props.onRoll : undefined}>Roll</div>
  }
}

function Scores(props) {
  return (
    <div className="scores">
      <table>
        <thead>
          <tr>
            <th/>
            {props.players.map((p, i) => {
              return <th key={i}>{p.User}</th>
            })}
          </tr>
        </thead>
        <tbody>
          <ScoreLine {...props} title="Aces" category="ones" />
          <ScoreLine {...props} title="Twos" category="twos" />
          <ScoreLine {...props} title="Threes" category="threes" />
          <ScoreLine {...props} title="Fours" category="fours" />
          <ScoreLine {...props} title="Fives" category="fives" />
          <ScoreLine {...props} title="Sixes" category="sixes" />
          <ScoreLine {...props} title="Bonus" category="bonus" />
          <ScoreLine {...props} title="Three of a kind" category="three-of-a-kind" />
          <ScoreLine {...props} title="Four of a kind" category="four-of-a-kind" />
          <ScoreLine {...props} title="Full House" category="full-house" />
          <ScoreLine {...props} title="Small Straight" category="small-straight" />
          <ScoreLine {...props} title="Large Straight" category="large-straight" />
          <ScoreLine {...props} title="Yahtzee" category="yahtzee" />
          <ScoreLine {...props} title="Chance" category="chance" />
          <tr>
            <td>Total</td>
            {props.players.map((p, i) => {
              let total = 0
              Object.entries(p.ScoreSheet).forEach(([c, v]) => total += v)
              return <td key={i}>{total}</td>
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

class ScoreLine extends React.Component {
  constructor(props) {
    super(props)
    this.handleClick = this.handleClick.bind(this)
  }

  handleClick() {
    if (this.props.category === 'bonus') {
      return
    }

    this.props.onScore(this.props.category)
  }

  render() {
    return <tr>
      <td>{this.props.title}</td>
      {this.props.players.map((p, i) => {
        const currentPlayer = parseInt(this.props.currentPlayer) === i && this.props.round < 13
        const hasScore = this.props.category in p.ScoreSheet
        const hasSuggestions = Object.keys(this.props.suggestions).length !== 0

        let bonusMessage
        if (this.props.category === 'bonus' && !('bonus' in p.ScoreSheet)) {
          const total =
            (p.ScoreSheet['ones'] || 0) +
            (p.ScoreSheet['twos'] || 0) +
            (p.ScoreSheet['threes'] || 0) +
            (p.ScoreSheet['fours'] || 0) +
            (p.ScoreSheet['fives'] || 0) +
            (p.ScoreSheet['sixes'] || 0)
          const remains = 63 - total
          if (remains > 0) {
            bonusMessage = "still need " + remains
          }
        }
        bonusMessage = hasSuggestions ? bonusMessage : ""

        let className = ''
        if (currentPlayer) {
          className += ' current-player'

          if (this.props.category !== 'bonus' && this.props.active) {
            className += ' actionable'
          }

        }
        if (!hasScore) {
          className += ' suggestion'
        }

        return <td className={className} key={i} onClick={this.props.active ? this.handleClick : undefined}>
           {(currentPlayer && !hasScore) ?
             (this.props.category !== 'bonus' ? this.props.suggestions[this.props.category] : bonusMessage) :
             p.ScoreSheet[this.props.category]}
          </td>
      })}
    </tr>
  }
}

export default Yahtzee;

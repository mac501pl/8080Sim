import * as React from 'react';
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBug, faPlay, faShoePrints, faTools } from '@fortawesome/free-solid-svg-icons';

export interface ExecuteButtonPropTypes {
  steps: (event: React.MouseEvent<HTMLButtonElement>) => void;
  run: (event: React.MouseEvent<HTMLButtonElement>) => void;
  debug: (event: React.MouseEvent<HTMLButtonElement>) => void;
  build: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export default function ExecuteButtons({ steps, run, debug, build }: ExecuteButtonPropTypes): JSX.Element {
  return <div className="d-flex flex-column">
    <OverlayTrigger
      placement="left"
      delay={{ show: 250, hide: 400 }}
      overlay={(props): JSX.Element => <Tooltip id="button-tooltip" {...props}>Run</Tooltip>}
    >
      <Button className="m-1" variant="outline-light" onClick={ run } id="run-button"><FontAwesomeIcon icon={faPlay} /></Button>
    </OverlayTrigger>
    <OverlayTrigger
      placement="left"
      delay={{ show: 250, hide: 400 }}
      overlay={(props): JSX.Element => <Tooltip id="button-tooltip" {...props}>Single-step mode</Tooltip>}
    >
      <Button className="m-1" variant="outline-light" onClick={ steps } id="build-button"><FontAwesomeIcon icon={faShoePrints} /></Button>
    </OverlayTrigger>
    <OverlayTrigger
      placement="left"
      delay={{ show: 250, hide: 400 }}
      overlay={(props): JSX.Element => <Tooltip id="button-tooltip" {...props}>Debug</Tooltip>}
    >
      <Button className="m-1" variant="outline-light" onClick={ debug } id="debug-button"><FontAwesomeIcon icon={faBug} /></Button>
    </OverlayTrigger>
    <OverlayTrigger
      placement="left"
      delay={{ show: 250, hide: 400 }}
      overlay={(props): JSX.Element => <Tooltip id="button-tooltip" {...props}>Export memory</Tooltip>}
    >
      <Button className="m-1" variant="outline-light" onClick={ build } id="build-button"><FontAwesomeIcon icon={faTools} /></Button>
    </OverlayTrigger>
  </div>;
}

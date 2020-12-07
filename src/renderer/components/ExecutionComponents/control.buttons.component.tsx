import * as React from 'react';
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { ExecutionMode } from '@renderer/components/app';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faPlay, faStepForward, faUndoAlt } from '@fortawesome/free-solid-svg-icons';

interface ControlButtonsPropTypes {
  executionEnded: boolean;
  mode: ExecutionMode;
  resumeExecution: () => void;
  setParentState: (state: { isExecuting: boolean }) => void;
  restart: () => void;
  setExecutionMode: (mode: ExecutionMode) => Promise<void>;
  awaitInput: boolean;
}

export default function ControlButtons({ executionEnded, mode, resumeExecution, setParentState, restart, setExecutionMode, awaitInput }: ControlButtonsPropTypes): JSX.Element {
  return <div className="w-auto d-flex flex-column">
    { mode !== ExecutionMode.RUN && <OverlayTrigger
      placement="left"
      delay={{ show: 250, hide: 400 }}
      overlay={(props): JSX.Element => <Tooltip id="button-tooltip" {...props}>Step</Tooltip>}
    >
      <Button disabled={executionEnded || awaitInput} className="m-1" variant="outline-light" onClick={(): void => {
        void setExecutionMode(ExecutionMode.STEPS);
        resumeExecution();
      }}><FontAwesomeIcon icon={faStepForward}/></Button>
    </OverlayTrigger>}
    { mode === ExecutionMode.DEBUG &&
      <OverlayTrigger
        placement="left"
        delay={{ show: 250, hide: 400 }}
        overlay={(props): JSX.Element => <Tooltip id="button-tooltip" {...props}>Continue</Tooltip>}
      >
        <Button disabled={executionEnded || awaitInput} className="m-1" variant="outline-light" onClick={ (): void => {
          void setExecutionMode(ExecutionMode.DEBUG);
          resumeExecution();
        } }><FontAwesomeIcon icon={faPlay} /></Button>
      </OverlayTrigger>
    }
    <OverlayTrigger
      placement="left"
      delay={{ show: 250, hide: 400 }}
      overlay={(props): JSX.Element => <Tooltip id="button-tooltip" {...props}>Back to edit</Tooltip>}
    >
      <Button className="m-1" variant="outline-light" onClick={(): void => {
        setParentState({ isExecuting: false });
      }}><FontAwesomeIcon icon={faChevronLeft}/></Button>
    </OverlayTrigger>
    { mode !== ExecutionMode.RUN && <OverlayTrigger
      placement="left"
      delay={{ show: 250, hide: 400 }}
      overlay={(props): JSX.Element => <Tooltip id="button-tooltip" {...props}>Reset</Tooltip>}
    >
      <Button className="m-1" variant="outline-light" onClick={(): void => {
        restart();
      }}><FontAwesomeIcon icon={faUndoAlt}/></Button>
    </OverlayTrigger>}
  </div>;
}

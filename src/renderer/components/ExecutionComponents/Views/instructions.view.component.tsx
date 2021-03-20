import * as React from 'react';
import { ListGroup, ListGroupItem } from 'react-bootstrap';
import Instruction from '@/main/assembler/Types/Instruction';
import { LinesWithOpcodes } from '@/main/assembler/assemble';
import { PrettyPrintable } from '@/renderer/EditorConfiguration/editor.documentFormattingProvider';

interface InstructionViewProps {
  instructions: Array<LinesWithOpcodes>;
  currentPC: number;
  debug: boolean;
}

interface InstructionViewState {
  offset: number;
}

export default class InstructionsView extends React.PureComponent<InstructionViewProps, InstructionViewState> {
  private readonly filteredInstructions: Array<LinesWithOpcodes>;
  public state: {
    offset: 0;
  }

  public constructor(props: InstructionViewProps) {
    super(props);
    this.filteredInstructions = props.instructions.filter((entry, index, arr) => {
      const { line: { content, label } } = entry;
      if (content instanceof Instruction) {
        return true;
      }
      if (label && !content) {
        return arr[index + 1]?.line.content instanceof Instruction;
      }
      return false;
    });
    this.state = {
      offset: 0
    };
  }

  private getCurrentExecutionIndex(): number {
    return this.filteredInstructions.findIndex(value => (value.line.content as Instruction)?.address === this.props.currentPC);
  }

  public render(): JSX.Element {
    const currentlyExecutedIndex = this.getCurrentExecutionIndex();
    const beginning = Math.max(currentlyExecutedIndex - 2, 0);
    const slicedInstructionArray = this.filteredInstructions.slice(beginning, beginning + 20);
    return (
      <div className="w-100 mt-1">
        <ListGroup variant="flush" className="border-top border-white flex-grow-1 pt-1">
          {slicedInstructionArray.map((entry, index) => [(entry.line.label && <ListGroupItem
            key={`labelItem${index}`}
            className="py-1 bg-dark text-muted"
          >
            {entry.line.label.prettyPrint()}
          </ListGroupItem>),
          (entry.line.content && <ListGroupItem
            key={`contentItem${index}`}
            className={`d-flex justify-content-between py-1 ${(entry.line.content as Instruction)?.address === this.props.currentPC ? 'bg-white text-dark' : 'bg-dark text-white'}`}
          >
            <div className="d-flex justify-content-between align-items-center">
              {(entry.line.content as Instruction).breakpoint && this.props.debug && <div className="instruction-breakpoint"/>}
              <div className="pl-3">{(entry.line.content as PrettyPrintable).prettyPrint()}</div>
            </div>
            <div className="float-right text-muted">{`; ${entry.bytes.map(byte => byte.toHex()).join(' ')}`}</div>
          </ListGroupItem>)]
          )}
        </ListGroup>
      </div>
    );
  }
}

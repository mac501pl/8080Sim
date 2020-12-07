import * as React from 'react';
import HexNum from '@main/assembler/Types/HexNum';
import { Button, Form, OverlayTrigger, Table, Tooltip } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown, faArrowUp, faFont, faEdit, faBackspace } from '@fortawesome/free-solid-svg-icons';
import { findInstructionSizeByOpcode, chunk } from '@utils/Utils';

interface MemoryViewProps {
  assemblerOutput: Array<HexNum>;
  currentPC: number;
  updateAssemblerCode: (assemblerCode: Array<HexNum>) => void;
}

interface MemoryViewState {
  displayAsAscii: boolean;
  memoryOffset: number;
  editing: boolean;
  assemblerOutput: Array<HexNum>;
  previousOutput: Array<HexNum>;
}

export default class MemoryView extends React.PureComponent<MemoryViewProps, MemoryViewState> {
  private readonly numberOfVisibleLines: number;
  private readonly lineWidth: number;

  public state: {
    displayAsAscii: false;
    memoryOffset: 0;
    editing: false;
    assemblerOutput: Array<HexNum>;
    previousOutput: Array<HexNum>;
  }

  public constructor(props: MemoryViewProps) {
    super(props);

    this.numberOfVisibleLines = 5;
    this.lineWidth = 0x10;

    this.state = {
      displayAsAscii: false,
      memoryOffset: 0,
      editing: false,
      assemblerOutput: props.assemblerOutput,
      previousOutput: props.assemblerOutput
    };
  }

  private changeToAscii(): void {
    this.setState({ displayAsAscii: !this.state.displayAsAscii, editing: false });
  }

  private moveTableUp(): void {
    if (this.state.memoryOffset > 0) {
      this.setState({ memoryOffset: this.state.memoryOffset - 1 });
    }
  }

  private moveTableDown(paddedArrayLength: number): void {
    if ((this.state.memoryOffset + this.numberOfVisibleLines) * this.lineWidth < paddedArrayLength) {
      this.setState({ memoryOffset: this.state.memoryOffset + 1 });
    }
  }

  private isCurrentInstruction(index: number, currentInstructionSize: number): boolean {
    return index >= this.props.currentPC && index < this.props.currentPC + currentInstructionSize;
  }

  private canBeEdited(index: number, currentInstructionSize: number, assemblerOutputLength: number): boolean {
    return index >= this.props.currentPC + currentInstructionSize && index < assemblerOutputLength;
  }

  private generateVerticalNumberHeaders(colIndex: number): string {
    return `${(colIndex + this.state.memoryOffset).toString(16).toUpperCase()}0`.padStart(4, '0');
  }

  private generateTableHeader(): JSX.Element {
    return <tr>
      <th>{}</th>
      {[...Array(this.lineWidth).keys()].map(key => <th key={`th${key}`}>{new HexNum(key).toHex()}</th>)}
    </tr>;
  }

  private updateMemoryCell(index: number, newValue: string): void {
    if (this.isValidHexNumber(newValue)) {
      this.setState(({ assemblerOutput }) => ({
        assemblerOutput: [
          ...assemblerOutput.slice(0, index),
          new HexNum(parseInt(newValue, 16)),
          ...assemblerOutput.slice(index + 1)
        ]
      }));
    }
  }

  private submitChanges(): void {
    this.setState({ editing: false, previousOutput: this.state.assemblerOutput });
    this.props.updateAssemblerCode(this.state.assemblerOutput);
  }

  private discardChanges(): void {
    this.setState({ editing: false, assemblerOutput: this.state.previousOutput });
  }

  private calculateOneDimensionalIndexFromChunkedArray(colIndex: number, rowIndex: number): number {
    return (this.state.memoryOffset * this.lineWidth) + rowIndex * this.lineWidth + colIndex;
  }

  private isValidHexNumber(value: string): boolean {
    return (/[0-9a-f]{1,2}/i).test(value);
  }

  public render(): JSX.Element {
    const assemblerOutputLength = this.props.assemblerOutput.length;
    const paddingLength = Math.ceil(assemblerOutputLength / 0x100) * 0x100 - assemblerOutputLength;

    const paddedArray = [...this.state.assemblerOutput, ...new Array<HexNum>(paddingLength).fill(new HexNum())];
    const chunkedArray = chunk(paddedArray, this.lineWidth);

    const currentlyDisplayedArray = chunkedArray.slice(this.state.memoryOffset, this.state.memoryOffset + this.numberOfVisibleLines);

    return (
      <div className="d-flex flex-row w-100 flex-fill">
        <div className="flex-grow-1">
          <Table className="m-1 border-bottom border-white" variant="dark" size="sm" hover={true}>
            <thead>
              {this.generateTableHeader()}
            </thead>
            <tbody>
              { currentlyDisplayedArray.map((arrayChunk: Array<HexNum>, rowIndex: number) =>
                <tr key={`tr${rowIndex}`}>
                  <td>{this.generateVerticalNumberHeaders(rowIndex)}</td>
                  {arrayChunk.map((value: HexNum, colIndex: number) => {
                    const index = this.calculateOneDimensionalIndexFromChunkedArray(colIndex, rowIndex);
                    const currentInstruction = this.state.assemblerOutput[this.props.currentPC];
                    const currentInstructionSize = currentInstruction ? findInstructionSizeByOpcode(currentInstruction) : 0;
                    const editable = this.state.editing && !this.state.displayAsAscii && this.canBeEdited(index, currentInstructionSize, assemblerOutputLength);
                    return <td
                      className={currentInstruction && this.isCurrentInstruction(index, currentInstructionSize) ? 'text-dark bg-white' : ''}
                      key={rowIndex * this.lineWidth + colIndex}
                    >
                      <Form.Control
                        disabled={!editable}
                        readOnly={!editable}
                        size="sm"
                        className={`memory-cell ${editable ? 'memory-cell-editing' : 'memory-cell-not-editing'}`}
                        type="text"
                        value={!this.state.displayAsAscii ? value.toHex() : value.toAscii()}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>): void => {
                          this.updateMemoryCell(index, event.target.value);
                        }}
                      />
                    </td>;
                  })}
                </tr>
              )}
            </tbody>
          </Table>
        </div>
        <div className="d-flex flex-column justify-content-between">
          <div className="d-flex flex-column">
            <OverlayTrigger
              placement="left"
              delay={{ show: 250, hide: 400 }}
              overlay={(props): JSX.Element => <Tooltip id="button-tooltip" {...props}>Show as ASCII characters</Tooltip>}
            >
              <Button className="m-1" variant="outline-light" onClick={this.changeToAscii.bind(this)}><FontAwesomeIcon icon={faFont} /></Button>
            </OverlayTrigger>
            { !this.state.displayAsAscii &&
            <OverlayTrigger
              placement="left"
              delay={{ show: 250, hide: 400 }}
              overlay={(props): JSX.Element => <Tooltip id="button-tooltip" {...props}>{this.state.editing ? 'Stop editing' : 'Edit'}</Tooltip>}
            >
              <Button className="m-1" active={this.state.editing} variant="outline-light" onClick={(): void => {
                if (this.state.editing) {
                  this.submitChanges();
                } else {
                  this.setState({ editing: true });
                }
              }}><FontAwesomeIcon icon={faEdit} /></Button>
            </OverlayTrigger>}
            {
              !this.state.displayAsAscii && this.state.editing &&
              <OverlayTrigger
                placement="left"
                delay={{ show: 250, hide: 400 }}
                overlay={(props): JSX.Element => <Tooltip id="button-tooltip" {...props}>Discard</Tooltip>}
              >
                <Button className="m-1" variant="outline-light" onClick={this.discardChanges.bind(this)}><FontAwesomeIcon icon={faBackspace} /></Button>
              </OverlayTrigger>
            }
          </div>
          <div className="d-flex flex-column">
            <Button className="m-1" variant="outline-light" onClick={(): void => {
              this.moveTableUp();
            }}><FontAwesomeIcon icon={faArrowUp} /></Button>
            <Button className="m-1" variant="outline-light" onClick={(): void => {
              this.moveTableDown(paddedArray.length);
            }}><FontAwesomeIcon icon={faArrowDown} /></Button>
          </div>
        </div>
      </div>
    );
  }
}

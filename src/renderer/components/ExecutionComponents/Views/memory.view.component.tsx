import * as React from 'react';
import HexNum from '@main/assembler/Types/HexNum';
import { Button, Form, Overlay, OverlayTrigger, Table, Tooltip } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown, faArrowUp, faFont, faEdit, faExchangeAlt } from '@fortawesome/free-solid-svg-icons';
import { findInstructionSizeByOpcode } from '@utils/Utils';
import { parseToInt } from '@/main/assembler/Parser';

interface MemoryViewProps {
  code: Array<HexNum>;
  currentPC: number;
  updateAssemblerCode: (assemblerCode: Array<HexNum>) => void;
}

interface MemoryViewState {
  displayAsAscii: boolean;
  memoryOffset: number;
  editing: boolean;
  showInputTooltip: boolean;
  locationToJumpTo: string;
  isInputInvalid: boolean;
}

export default class MemoryView extends React.Component<MemoryViewProps, MemoryViewState> {
  private readonly numberOfVisibleLines: number;
  private readonly lineWidth: number;
  private readonly overlayTarget: React.RefObject<HTMLButtonElement>;

  public state: {
    displayAsAscii: false;
    memoryOffset: 0;
    editing: false;
    showInputTooltip: false;
    locationToJumpTo: '',
    isInputInvalid: false,
  }

  public constructor(props: MemoryViewProps) {
    super(props);

    this.numberOfVisibleLines = 5;
    this.lineWidth = 0x10;

    this.overlayTarget = React.createRef();

    this.state = {
      displayAsAscii: false,
      memoryOffset: 0,
      editing: false,
      showInputTooltip: false,
      locationToJumpTo: '',
      isInputInvalid: false
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

  private moveTableDown(arrayLength: number): void {
    if ((this.state.memoryOffset + this.numberOfVisibleLines) * this.lineWidth < arrayLength) {
      this.setState({ memoryOffset: this.state.memoryOffset + 1 });
    }
  }

  private isCurrentInstruction(index: number, currentInstructionSize: number): boolean {
    return index >= this.props.currentPC && index < this.props.currentPC + currentInstructionSize;
  }

  private canBeEdited(index: number, currentInstructionSize: number): boolean {
    return index >= this.props.currentPC + currentInstructionSize || index < this.props.currentPC;
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
      const code = this.props.code;
      code[index] = new HexNum(parseInt(newValue, 16));
      this.props.updateAssemblerCode(code);
    }
  }

  private calculateOneDimensionalIndexFromChunkedArray(colIndex: number, rowIndex: number): number {
    return (this.state.memoryOffset * this.lineWidth) + rowIndex * this.lineWidth + colIndex;
  }

  private isValidHexNumber(value: string): boolean {
    return (/[0-9a-f]{1,2}/i).test(value);
  }

  private jumpToLocation(): void {
    try {
      const location = parseToInt(this.state.locationToJumpTo);
      let calculatedMemoryOffset = Math.floor(location / this.lineWidth);
      const actualLocation = calculatedMemoryOffset * 0x10 + 0xf;
      if (actualLocation > 0xffbf) {
        calculatedMemoryOffset = 0xffb;
      }
      this.setState({ memoryOffset: calculatedMemoryOffset, locationToJumpTo: '', isInputInvalid: false, showInputTooltip: false });
    } catch (e) {
      this.setState({ isInputInvalid: true });
    }
  }

  private chunk(array: Array<HexNum>): Array<Array<HexNum>> {
    const result = [];
    for (let i = 0; i < this.numberOfVisibleLines; i++) {
      const begin = this.lineWidth * (i + this.state.memoryOffset);
      const end = begin + this.lineWidth;
      result.push(array.slice(begin, end));
    }
    return result;
  }

  public render(): JSX.Element {
    const currentlyDisplayedArray = this.chunk(this.props.code);

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
                    const currentInstruction = this.props.code[this.props.currentPC];
                    const currentInstructionSize = currentInstruction ? findInstructionSizeByOpcode(currentInstruction) : 0;
                    const editable = this.state.editing && !this.state.displayAsAscii && this.canBeEdited(index, currentInstructionSize);
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
            <Button ref={this.overlayTarget} className="m-1" variant="outline-light" onClick={(): void => {
              this.setState({ showInputTooltip: !this.state.showInputTooltip
              });
            }}><FontAwesomeIcon icon={faExchangeAlt} /></Button>
            <Overlay
              placement="left"
              show={this.state.showInputTooltip}
              target={this.overlayTarget.current}

            >
              {({ placement, arrowProps, show: _show, popper, ...props }): JSX.Element => (
                <div style={{ width: '30%' }} {...props}>
                  <Form.Control
                    onKeyPress={(event: React.KeyboardEvent): void => {
                      if (event.key === 'Enter') {
                        this.jumpToLocation();
                      }
                    }}
                    autoFocus
                    isInvalid={this.state.isInputInvalid}
                    onChange={(e): void => this.setState({ locationToJumpTo: e.target.value })}
                    size="lg"
                    className="text-white bg-dark"></Form.Control>
                </div>
              )}
            </Overlay>
            { !this.state.displayAsAscii &&
            <OverlayTrigger
              placement="left"
              delay={{ show: 250, hide: 400 }}
              overlay={(props): JSX.Element => <Tooltip id="button-tooltip" {...props}>{this.state.editing ? 'Stop editing memory' : 'Edit memory'}</Tooltip>}
            >
              <Button className="m-1" active={this.state.editing} variant="outline-light" onClick={(): void => {
                this.setState({ editing: !this.state.editing });
              }}><FontAwesomeIcon icon={faEdit} /></Button>
            </OverlayTrigger>}
          </div>
          <div className="d-flex flex-column">
            <Button className="m-1" variant="outline-light" onClick={(): void => {
              this.moveTableUp();
            }}><FontAwesomeIcon icon={faArrowUp} /></Button>
            <Button className="m-1" variant="outline-light" onClick={(): void => {
              this.moveTableDown(this.props.code.length);
            }}><FontAwesomeIcon icon={faArrowDown} /></Button>
          </div>
        </div>
      </div>
    );
  }
}

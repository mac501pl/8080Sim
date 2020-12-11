import * as React from 'react';
import { CPUState } from '@/renderer/components/ExecutionComponents/cpu.component';
import { Col, Container, Row } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle, faDotCircle } from '@fortawesome/free-regular-svg-icons';

export default function CPUView(props: CPUState): JSX.Element {
  const { registers, SP, PC } = props;
  const { carry, zero, parity, auxiliaryCarry, sign } = props.flags.getContents();
  const unChecked = <FontAwesomeIcon icon={faCircle} />;
  const checked = <FontAwesomeIcon icon={faDotCircle} />;
  return (
    <div className="flex-grow-1 p-2 w-25">
      <Container>
        <Row>
          <Col>{carry.shortName} <span className="text-muted">({carry.name})</span></Col>
          <Col>{carry.value ? checked : unChecked }</Col>
        </Row>
        <Row>
          <Col>{zero.shortName} <span className="text-muted">({zero.name})</span></Col>
          <Col>{zero.value ? checked : unChecked }</Col>
        </Row>
        <Row>
          <Col>{parity.shortName} <span className="text-muted">({parity.name})</span></Col>
          <Col>{parity.value ? checked : unChecked }</Col>
        </Row>
        <Row>
          <Col>{auxiliaryCarry.shortName} <span className="text-muted">({auxiliaryCarry.name})</span></Col>
          <Col>{auxiliaryCarry.value ? checked : unChecked }</Col>
        </Row>
        <Row>
          <Col>{sign.shortName} <span className="text-muted">({sign.name})</span></Col>
          <Col>{sign.value ? checked : unChecked }</Col>
        </Row>
      </Container>
      <hr/>
      <Container>
        <Row>
          <Col>A: {registers.A.content.intValue} <span className="text-muted">({registers.A.content.toHex()}H)</span></Col>
        </Row>
        <Row>
          <Col>B: {registers.B.content.intValue} <span className="text-muted">({registers.B.content.toHex()}H)</span></Col>
          <Col>C: {registers.C.content.intValue} <span className="text-muted">({registers.C.content.toHex()}H)</span></Col>
        </Row>
        <Row>
          <Col>D: {registers.D.content.intValue} <span className="text-muted">({registers.D.content.toHex()}H)</span></Col>
          <Col>E: {registers.E.content.intValue} <span className="text-muted">({registers.E.content.toHex()}H)</span></Col>
        </Row>
        <Row>
          <Col>H: {registers.H.content.intValue} <span className="text-muted">({registers.H.content.toHex()}H)</span></Col>
          <Col>L: {registers.L.content.intValue} <span className="text-muted">({registers.L.content.toHex()}H)</span></Col>
        </Row>
      </Container>
      <hr/>
      <h6>SP: {SP.intValue} <span className="text-muted">({SP.toHex()}H)</span></h6>
      <h6>PC: {PC.intValue} <span className="text-muted">({PC.toHex()}H)</span></h6>
    </div>
  );
}
